import { describe, expect, it } from "vitest";
import { RECOVERY_WORDLIST } from "./wordlist";
import {
  decryptText,
  deriveKeyEncryptionKey,
  encryptText,
  exportKeyToBase64,
  generateDataEncryptionKey,
  generateRecoveryCode,
  generateSalt,
  importKeyFromBase64,
  unwrapDataEncryptionKey,
  wrapDataEncryptionKey,
} from "./index";

/**
 * Tests for the module that carries this product's entire privacy claim —
 * see docs/ROADMAP.md NK-02 and that module's own header comment. A
 * regression here is the one class of bug that's silent until someone's
 * archive is unrecoverable, so these lean toward "prove the failure modes
 * actually fail" (wrong secret, tampered ciphertext, wrong key) rather than
 * just the happy path.
 *
 * Deliberately not tested: internal Argon2id tuning constants (iterations,
 * memory cost) aren't exported, and reaching into the module's private
 * state to assert on them would couple the test to an implementation
 * detail a legitimate future retune could change for good reason. What's
 * tested instead is the property that actually matters — derivation is a
 * pure function of (secret, salt), so the same pair always works and any
 * change to either one doesn't.
 */

describe("encryptText / decryptText", () => {
  it("round-trips plaintext, including unicode", async () => {
    const dek = await generateDataEncryptionKey();
    const plaintext = "Dear diary — today felt 🌱 quietly hopeful. 日記";

    const payload = await encryptText(plaintext, dek);
    const result = await decryptText(payload, dek);

    expect(result).toBe(plaintext);
  });

  it("round-trips an empty string", async () => {
    const dek = await generateDataEncryptionKey();
    const payload = await encryptText("", dek);
    expect(await decryptText(payload, dek)).toBe("");
  });

  it("uses a fresh IV per call, so identical plaintext never produces identical ciphertext", async () => {
    const dek = await generateDataEncryptionKey();
    const a = await encryptText("same entry text", dek);
    const b = await encryptText("same entry text", dek);

    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects ciphertext that's been tampered with", async () => {
    const dek = await generateDataEncryptionKey();
    const payload = await encryptText("trust the auth tag", dek);

    const tampered = { ...payload, ciphertext: flipLastByte(payload.ciphertext) };
    await expect(decryptText(tampered, dek)).rejects.toThrow();
  });

  it("rejects a payload decrypted with the wrong key", async () => {
    const dek = await generateDataEncryptionKey();
    const otherDek = await generateDataEncryptionKey();
    const payload = await encryptText("not for you", dek);

    await expect(decryptText(payload, otherDek)).rejects.toThrow();
  });

  it("rejects a payload with a mismatched IV", async () => {
    const dek = await generateDataEncryptionKey();
    const a = await encryptText("first", dek);
    const b = await encryptText("second", dek);

    await expect(decryptText({ ciphertext: a.ciphertext, iv: b.iv }, dek)).rejects.toThrow();
  });
});

describe("wrapDataEncryptionKey / unwrapDataEncryptionKey", () => {
  it("round-trips a DEK under a passphrase", async () => {
    const dek = await generateDataEncryptionKey();
    const wrapped = await wrapDataEncryptionKey(dek, "correct horse battery staple");
    const unwrapped = await unwrapDataEncryptionKey(wrapped, "correct horse battery staple");

    // Compare via behavior, not key equality — CryptoKey objects from two
    // separate imports are never referentially or structurally comparable.
    const payload = await encryptText("wrapped under a passphrase", dek);
    expect(await decryptText(payload, unwrapped)).toBe("wrapped under a passphrase");
  });

  it("round-trips the same DEK under a recovery code — independently of the passphrase wrap", async () => {
    const dek = await generateDataEncryptionKey();
    const passphrase = "a passphrase only the user knows";
    const recoveryCode = generateRecoveryCode();

    const passphraseWrap = await wrapDataEncryptionKey(dek, passphrase);
    const recoveryWrap = await wrapDataEncryptionKey(dek, recoveryCode);

    // Two different secrets, so two different salts and wrapped blobs —
    // this is the dual-backup-path property the recovery code exists for.
    expect(passphraseWrap.salt).not.toBe(recoveryWrap.salt);
    expect(passphraseWrap.wrappedKey).not.toBe(recoveryWrap.wrappedKey);

    const viaPassphrase = await unwrapDataEncryptionKey(passphraseWrap, passphrase);
    const viaRecovery = await unwrapDataEncryptionKey(recoveryWrap, recoveryCode);

    const payload = await encryptText("either path unlocks the same journal", dek);
    expect(await decryptText(payload, viaPassphrase)).toBe("either path unlocks the same journal");
    expect(await decryptText(payload, viaRecovery)).toBe("either path unlocks the same journal");
  }, 20_000);

  it("rejects unwrapping with the wrong passphrase", async () => {
    const dek = await generateDataEncryptionKey();
    const wrapped = await wrapDataEncryptionKey(dek, "the right passphrase");

    await expect(unwrapDataEncryptionKey(wrapped, "the wrong passphrase")).rejects.toThrow();
  }, 10_000);

  it("rejects unwrapping against a different salt — derivation is not secret-only", async () => {
    const dek = await generateDataEncryptionKey();
    const wrapped = await wrapDataEncryptionKey(dek, "same secret");

    // Re-derive the KEK for the *same secret* but a *different* salt, then
    // try to use it against the original wrapped blob — proves the salt is
    // load-bearing in derivation, not decorative.
    const wrongSaltKek = await deriveKeyEncryptionKey("same secret", generateSalt());
    await expect(
      crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(wrapped.iv) },
        wrongSaltKek,
        base64ToBytes(wrapped.wrappedKey),
      ),
    ).rejects.toThrow();
  }, 10_000);
});

describe("exportKeyToBase64 / importKeyFromBase64", () => {
  it("round-trips a key's raw material exactly", async () => {
    const dek = await generateDataEncryptionKey();
    const exported = await exportKeyToBase64(dek);
    const reimported = await importKeyFromBase64(exported);

    const payload = await encryptText("export/import round trip", dek);
    expect(await decryptText(payload, reimported)).toBe("export/import round trip");
  });
});

describe("generateRecoveryCode", () => {
  it("produces 12 space-separated words, all drawn from the wordlist", () => {
    const code = generateRecoveryCode();
    const words = code.split(" ");

    expect(words).toHaveLength(12);
    for (const word of words) {
      expect(RECOVERY_WORDLIST).toContain(word);
    }
  });

  it("varies between calls", () => {
    const codes = new Set(Array.from({ length: 5 }, () => generateRecoveryCode()));
    // 256^12 possibilities — five draws colliding would indicate a broken
    // RNG, not bad luck.
    expect(codes.size).toBe(5);
  });
});

describe("generateSalt", () => {
  it("returns 16 random bytes that vary between calls", () => {
    const a = generateSalt();
    const b = generateSalt();

    expect(a).toHaveLength(16);
    expect(b).toHaveLength(16);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

// ---------------------------------------------------------------------------
// Local helpers — test-only, not exported from the module under test.
// ---------------------------------------------------------------------------

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function flipLastByte(b64: string): string {
  const bytes = base64ToBytes(b64);
  bytes[bytes.length - 1] ^= 0xff;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
