/**
 * Vercel Cron target for the daily reminder — see docs/ROADMAP.md NK-10.
 * Scoped deliberately to just this one notification type: "playback ready"
 * and "manifestation resurfaced" have toggles in notification_prefs but no
 * send trigger anywhere yet — that's real, separate, unbuilt work, not
 * something this route covers by proxy.
 *
 * Runs once daily at a single fixed UTC time (see web/vercel.json) sent to
 * every user with daily_prompt_enabled — NOT at each user's individually
 * configured daily_prompt_time. Vercel Cron on the Hobby plan only
 * supports one invocation per day with ±59-minute imprecision (confirmed
 * against Vercel's own docs before building this), which makes honoring a
 * genuinely per-user, precise send time structurally impossible without
 * upgrading plans. That's a real, stated gap in what the Settings/
 * onboarding UI implies is configurable — not silently worked around.
 *
 * Idempotent by design: Vercel's own cron docs warn invocations can be
 * duplicated or missed (best-effort delivery, no retries), so this only
 * sends to a user whose notification_prefs.daily_prompt_last_sent_date is
 * behind today's UTC date, then advances it — calling this twice in one
 * day is a safe no-op for anyone already sent to.
 */

import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

// "Time to reflect" is the decided *body* text (docs/ARCHITECTURE.md §8,
// NK-08) — the title stays app-identifying, matching how the SW's push
// handler already falls back to "The Nook" for a payload with no title.
const TITLE = "The Nook";
const BODY = "Time to reflect";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }
  webpush.setVapidDetails("mailto:sipandey.sape006@gmail.com", vapidPublicKey, vapidPrivateKey);

  const today = new Date().toISOString().slice(0, 10); // UTC date, matches the cron's own UTC schedule
  const supabase = getSupabaseServiceRoleClient();

  const { data: prefs, error: prefsError } = await supabase
    .from("notification_prefs")
    .select("user_id")
    .eq("daily_prompt_enabled", true)
    .or(`daily_prompt_last_sent_date.is.null,daily_prompt_last_sent_date.lt.${today}`);

  if (prefsError) return NextResponse.json({ error: prefsError.message }, { status: 500 });

  let sent = 0;
  let staleSubscriptionsRemoved = 0;

  for (const { user_id } of prefs ?? []) {
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title: TITLE, body: BODY, url: "/" }),
        );
        sent++;
      } catch (err) {
        // 404/410 means the browser's push service has permanently
        // invalidated this subscription (uninstalled, permission revoked,
        // etc.) — clean it up rather than retrying it forever. Any other
        // error is transient/unexpected; leave the row and move on, this
        // is a best-effort fan-out, not a job that should fail entirely
        // over one bad subscription.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          staleSubscriptionsRemoved++;
        } else {
          // Not the expected/handled "gone" case — genuinely unexpected,
          // so it should be visible in Vercel's function logs even though
          // it doesn't fail the whole job. No production error monitoring
          // exists yet (docs/ROADMAP.md NK-06); this is the cheap interim
          // version of "don't let a real failure be silent."
          console.error("[daily-reminder] sendNotification failed", { statusCode, error: err });
        }
      }
    }

    await supabase
      .from("notification_prefs")
      .update({ daily_prompt_last_sent_date: today })
      .eq("user_id", user_id);
  }

  return NextResponse.json({
    usersProcessed: prefs?.length ?? 0,
    notificationsSent: sent,
    staleSubscriptionsRemoved,
  });
}
