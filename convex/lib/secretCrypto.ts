/**
 * Encrypt/decrypt small secrets for storage in Convex.
 *
 * IMPORTANT: This protects secrets at rest in Convex. If the secret must be
 * used in the browser (direct WS), it will still be revealed client-side at
 * runtime. This only reduces accidental leakage (logs/exports) and enables
 * safe storage/migrations.
 */

const KEY_ENV = "OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // TS libdefs for WebCrypto expect ArrayBuffer in some environments.
  // Our Uint8Arrays are backed by ArrayBuffer, so this cast is safe.
  const buf = bytes.buffer as ArrayBuffer;
  if (bytes.byteOffset === 0 && bytes.byteLength === buf.byteLength) return buf;
  return buf.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

let cachedKey: CryptoKey | null = null;
let cachedKeyHex: string | null = null;

async function getAesKey(): Promise<CryptoKey> {
  const keyHex = process.env[KEY_ENV];
  if (!keyHex) {
    throw new Error(
      `Server misconfigured: ${KEY_ENV} is not set (expected 64 hex chars).`,
    );
  }

  const normalized = keyHex.trim().toLowerCase();
  if (cachedKey && cachedKeyHex === normalized) return cachedKey;

  const raw = hexToBytes(normalized);
  if (raw.length !== 32) {
    throw new Error(
      `Server misconfigured: ${KEY_ENV} must be 32 bytes (64 hex chars).`,
    );
  }

  cachedKey = await crypto.subtle.importKey("raw", toArrayBuffer(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  cachedKeyHex = normalized;
  return cachedKey;
}

export type EncryptedSecretHex = {
  ciphertextHex: string;
  ivHex: string;
};

export async function encryptSecretToHex(
  plaintext: string,
): Promise<EncryptedSecretHex> {
  const key = await getAesKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const data = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(data),
  );
  return {
    ciphertextHex: bytesToHex(new Uint8Array(cipherBuf)),
    ivHex: bytesToHex(iv),
  };
}

export async function decryptSecretFromHex(
  ciphertextHex: string,
  ivHex: string,
): Promise<string> {
  const key = await getAesKey();
  const ciphertext = hexToBytes(ciphertextHex);
  const iv = hexToBytes(ivHex);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext),
  );
  return new TextDecoder().decode(plainBuf);
}
