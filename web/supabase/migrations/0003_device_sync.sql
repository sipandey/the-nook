-- Multi-device key sync. A new (locked) device creates a short-lived
-- pairing session; an already-unlocked device (same user, verified via
-- Clerk auth on both ends) uploads the DEK encrypted under a one-time
-- "channel key" that's generated client-side on the new device and never
-- transmitted to this server — only embedded visually in a QR code / the
-- URL fragment (which browsers never send in requests). This table only
-- ever holds that ciphertext, briefly, and rows are deleted on pickup or
-- expiry. See docs/ARCHITECTURE.md for the surrounding key model.

create table device_sync_sessions (
  pairing_id text primary key,
  user_id text not null,
  encrypted_dek text,
  encrypted_dek_iv text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index device_sync_sessions_user_idx on device_sync_sessions (user_id);

alter table device_sync_sessions enable row level security;

create policy "users manage their own device sync sessions"
  on device_sync_sessions
  for all
  using (user_id = requesting_user_id())
  with check (user_id = requesting_user_id());
