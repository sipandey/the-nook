-- Fix: ciphertext/IV/salt columns were declared bytea in 0001, but
-- src/lib/crypto (and JSON generally) always produces base64 *strings* —
-- PostgREST expects bytea input as Postgres hex-format text ("\x..."), not
-- base64, so round-tripping through the REST API as-is would corrupt data.
-- Since nothing has written real rows yet, switch to `text` and store
-- base64 directly — simpler, and there's no reason for Postgres to
-- interpret these bytes; they're opaque ciphertext either way.

alter table journal_keys
  alter column wrapped_dek type text using encode(wrapped_dek, 'escape'),
  alter column wrapped_dek_iv type text using encode(wrapped_dek_iv, 'escape'),
  alter column wrapped_dek_salt type text using encode(wrapped_dek_salt, 'escape'),
  alter column wrapped_dek_recovery type text using encode(wrapped_dek_recovery, 'escape'),
  alter column wrapped_dek_recovery_iv type text using encode(wrapped_dek_recovery_iv, 'escape'),
  alter column wrapped_dek_recovery_salt type text using encode(wrapped_dek_recovery_salt, 'escape');

alter table entries
  alter column encrypted_content type text using encode(encrypted_content, 'escape'),
  alter column iv type text using encode(iv, 'escape');

alter table manifestations
  alter column encrypted_text type text using encode(encrypted_text, 'escape'),
  alter column iv type text using encode(iv, 'escape');
