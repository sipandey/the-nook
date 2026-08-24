-- Web Push subscriptions — see docs/ROADMAP.md NK-09. VAPID keys have sat
-- unused in .env.example since the schema was first scaffolded; this is
-- the storage side that finally consumes them.
--
-- Keyed by endpoint, not user_id: a user's own devices/browsers each
-- register an independent subscription (endpoint + key pair), and one
-- user can have several at once (phone, laptop, ...). NK-10's send job
-- fans out to every row for a user, not just one.
--
-- p256dh/auth are the subscription's own public key and auth secret (part
-- of the Push API's standard PushSubscription shape) — not journal
-- content, no encryption needed here; the payloads sent through this
-- channel are the generic notification bodies decided in NK-08
-- (ARCHITECTURE.md §8), never entry text.
create table push_subscriptions (
  endpoint text primary key,
  user_id text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- NK-10's cron looks up every subscription for a user before fanning out
-- a push; this index covers that lookup directly.
create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- Same shape as every other per-user table in this schema.
create policy "users manage their own push subscriptions"
  on push_subscriptions
  for all
  using (user_id = requesting_user_id())
  with check (user_id = requesting_user_id());
