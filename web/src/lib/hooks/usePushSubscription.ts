"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PREVIEW_MODE } from "@/lib/preview";

/**
 * Web Push subscribe/unsubscribe — see docs/ROADMAP.md NK-09. Separate
 * from useNotificationPrefs: the three boolean prefs control which
 * notification *types* a subscribed browser receives (NK-10's send job
 * reads those), this controls whether a subscription exists at all. A
 * user can flip the type toggles without ever granting permission — this
 * hook is what actually asks for it and registers with the push service.
 */

export type PushSubscriptionStatus = "unsupported" | "denied" | "unsubscribed" | "subscribed";

// The VAPID public key arrives as base64url; PushManager.subscribe() wants
// raw bytes as its applicationServerKey.
function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getStatus(): Promise<PushSubscriptionStatus> {
  // No real Clerk session to POST a subscription against — see
  // src/lib/preview.ts. The UI hides subscribe controls for this status.
  if (PREVIEW_MODE) return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing ? "subscribed" : "unsubscribed";
}

export function usePushSubscriptionStatus() {
  return useQuery({
    queryKey: ["pushSubscriptionStatus"],
    queryFn: getStatus,
  });
}

export function useSubscribeToPush() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission denied");

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidKey),
      });

      const json = subscription.toJSON();
      const res = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Failed to save push subscription");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pushSubscriptionStatus"] });
    },
  });
}

export function useUnsubscribeFromPush() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch("/api/push-subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pushSubscriptionStatus"] });
    },
  });
}
