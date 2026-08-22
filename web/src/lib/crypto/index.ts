/**
 * Client-side envelope encryption for journal content.
 *
 * This module never runs on the server. Everything it touches — the journal
 * passphrase, the recovery code, and the unwrapped Data-Encryption Key (DEK) —
 * must stay in browser memory only. See docs/ARCHITECTURE.md §5 for the full
 * key-wrapping design this implements.
 *
 * Primitives:
 * - Argon2id (via hash-wasm) derives a Key-Encryption Key (KEK) from a
 *   low-entropy human secret (passphrase or recovery code) + a random salt.
 * - AES-256-GCM (via Web Crypto / SubtleCrypto) both wraps the DEK with a KEK
 *   and encrypts entry/manifestation plaintext with the DEK.
 */

import { argon2id } from "hash-wasm";
import { RECOVERY_WORDLIST } from "./wordlist";

const AES_KEY_LENGTH = 256;
const GCM_IV_BYTES = 12;
const ARGON2_SALT_BYTES = 16;

export interface WrappedKeyMaterial {
  /** Base64: AES-GCM(DEK, KEK) */
  wrappedKey: string;
  /** Base64: IV used for the wrap operation */
  iv: string;
  /** Base64: Argon2id salt used to derive the KEK */
  salt: string;
}

export interface EncryptedPayload {
  /** Base64: AES-GCM ciphertext */
  ciphertext: string;
  /** Base64: IV used for this specific encryption */
  iv: string;
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

// ---------------------------------------------------------------------------
// Key derivation (KEK from a human secret)
// ---------------------------------------------------------------------------

/**
 * Derives a Key-Encryption Key from a passphrase or recovery code using
 * Argon2id, then imports it as a non-extractable AES-GCM CryptoKey.
 *
 * Tuned for a client-side interactive login (not a batch job): memory cost
 * is deliberately high relative to iterations to resist GPU cracking while
 * staying under ~1s on a typical phone.
 */
export async function deriveKeyEncryptionKey(
  secret: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const derivedBytes = await argon2id({
    password: secret,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64 MB
    hashLength: AES_KEY_LENGTH / 8,
    outputType: "binary",
  });

  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(derivedBytes as Uint8Array),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export function generateSalt(): Uint8Array<ArrayBuffer> {
  return randomBytes(ARGON2_SALT_BYTES);
}

// ---------------------------------------------------------------------------
// Data-Encryption Key (DEK) — one per user, generated once at signup
// ---------------------------------------------------------------------------

export async function generateDataEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true, // extractable — we need to wrap its raw bytes with the KEK
    ["encrypt", "decrypt"],
  );
}

/**
 * Generic AES-GCM key <-> base64 conversion. Used for the DEK itself (when
 * handing it to encryptText/decryptText as data, e.g. during device sync —
 * see src/lib/deviceSync.ts) and for the device-sync "channel key," which
 * is structurally identical to a DEK (a random AES-256 key) but serves a
 * different purpose: encrypting one handoff, not the journal.
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return toBase64(new Uint8Array(raw));
}

export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
  const raw = fromBase64(base64);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Wraps the DEK with a KEK derived from a human secret (passphrase or
 * recovery code). Returns everything needed to store server-side and later
 * unwrap — the KEK itself is never stored or transmitted.
 */
export async function wrapDataEncryptionKey(
  dek: CryptoKey,
  secret: string,
): Promise<WrappedKeyMaterial> {
  const salt = generateSalt();
  const kek = await deriveKeyEncryptionKey(secret, salt);

  const rawDek = await crypto.subtle.exportKey("raw", dek);
  const iv = randomBytes(GCM_IV_BYTES);
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    kek,
    rawDek,
  );

  return {
    wrappedKey: toBase64(new Uint8Array(wrapped)),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

/**
 * Re-derives the KEK from a human secret + stored salt, then unwraps the DEK.
 * Throws if the secret is wrong (AES-GCM auth tag fails) — callers should
 * treat any rejection here as "wrong passphrase," not attempt to inspect it.
 */
export async function unwrapDataEncryptionKey(
  material: WrappedKeyMaterial,
  secret: string,
): Promise<CryptoKey> {
  const salt = fromBase64(material.salt);
  const kek = await deriveKeyEncryptionKey(secret, salt);

  const iv = fromBase64(material.iv);
  const wrapped = fromBase64(material.wrappedKey);

  const rawDek = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    kek,
    wrapped,
  );

  return crypto.subtle.importKey("raw", rawDek, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// ---------------------------------------------------------------------------
// Entry / manifestation content encryption (with the DEK)
// ---------------------------------------------------------------------------

export async function encryptText(
  plaintext: string,
  dek: CryptoKey,
): Promise<EncryptedPayload> {
  const iv = randomBytes(GCM_IV_BYTES);
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    encoded,
  );

  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
  };
}

export async function decryptText(
  payload: EncryptedPayload,
  dek: CryptoKey,
): Promise<string> {
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    dek,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

// ---------------------------------------------------------------------------
// Recovery code
// ---------------------------------------------------------------------------

const RECOVERY_PHRASE_LENGTH = 12;

/**
 * Generates a human-writable recovery phrase, e.g. "ocean velvet prism
 * silent quartz dawn echo lunar timber silver ember bloom" — 12 words from
 * a 256-word list, ~96 bits of entropy. Easier to transcribe by hand and
 * harder to mistype than a mixed-case alphanumeric code; the underlying
 * security mechanism is unchanged, it's just a different string fed into
 * the same Argon2id derivation in deriveKeyEncryptionKey().
 */
export function generateRecoveryCode(): string {
  if (RECOVERY_WORDLIST.length !== 256) {
    // Would silently weaken entropy per word if this list ever drifted —
    // fail loudly instead.
    throw new Error(
      `RECOVERY_WORDLIST must have exactly 256 entries, has ${RECOVERY_WORDLIST.length}`,
    );
  }

  const bytes = randomBytes(RECOVERY_PHRASE_LENGTH);
  const words: string[] = [];
  for (let i = 0; i < RECOVERY_PHRASE_LENGTH; i++) {
    words.push(RECOVERY_WORDLIST[bytes[i] % 256]);
  }
  return words.join(" ");
}
