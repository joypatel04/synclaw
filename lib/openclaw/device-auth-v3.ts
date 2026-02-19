/**
 * OpenClaw strict device-auth helpers (gateway protocol v3).
 *
 * References used for this implementation:
 * - https://raw.githubusercontent.com/openclaw/openclaw/main/src/gateway/protocol/schema/frames.ts
 * - https://raw.githubusercontent.com/openclaw/openclaw/main/src/gateway/protocol/client-info.ts
 * - https://docs.openclaw.ai/reference/gateway/bridge-protocol
 *
 * Targeted to current OpenClaw behavior (tested against 2026.2.x line).
 */
type StoredDeviceIdentityV2 = {
  version: 2;
  alg: "Ed25519";
  deviceId: string;
  publicKey: string; // base64url(SPKI)
  privateJwk: JsonWebKey;
  createdAt: number;
};

export const OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V2 =
  "sutraha:openclaw:deviceIdentity:v2";
export const OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V1 =
  "sutraha:openclaw:deviceIdentity:v1";

function toUtf8Bytes(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  const arr = new Uint8Array(digest);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseStoredIdentity(raw: string | null): StoredDeviceIdentityV2 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDeviceIdentityV2>;
    if (
      parsed.version === 2 &&
      parsed.alg === "Ed25519" &&
      typeof parsed.deviceId === "string" &&
      parsed.deviceId.length > 0 &&
      typeof parsed.publicKey === "string" &&
      parsed.publicKey.length > 0 &&
      parsed.privateJwk &&
      typeof parsed.createdAt === "number"
    ) {
      return parsed as StoredDeviceIdentityV2;
    }
    return null;
  } catch {
    return null;
  }
}

export function readStoredDeviceIdentityV2(): StoredDeviceIdentityV2 | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredIdentity(
      window.localStorage.getItem(OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V2),
    );
  } catch {
    return null;
  }
}

export function resetStoredDeviceIdentityV2() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V2);
    // Best-effort cleanup of legacy key on first strict rollout.
    window.localStorage.removeItem(OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V1);
  } catch {
    // ignore
  }
}

async function importPrivateKeyFromStored(
  stored: StoredDeviceIdentityV2,
): Promise<CryptoKey | null> {
  try {
    return await crypto.subtle.importKey(
      "jwk",
      stored.privateJwk,
      { name: "Ed25519" },
      false,
      ["sign"],
    );
  } catch {
    return null;
  }
}

export async function ensureDeviceIdentityV3(): Promise<{
  deviceId: string;
  publicKey: string;
  sign: (message: Uint8Array) => Promise<string>;
} | null> {
  if (typeof window === "undefined" || !window.isSecureContext) return null;
  if (!crypto?.subtle) return null;

  const stored = readStoredDeviceIdentityV2();
  if (stored) {
    const key = await importPrivateKeyFromStored(stored);
    if (key) {
      return {
        deviceId: stored.deviceId,
        publicKey: stored.publicKey,
        sign: async (message: Uint8Array) => {
          const sig = await crypto.subtle.sign(
            { name: "Ed25519" },
            key,
            toArrayBuffer(message),
          );
          return toBase64Url(new Uint8Array(sig));
        },
      };
    }
  }

  try {
    const keyPair = await crypto.subtle.generateKey(
      { name: "Ed25519" },
      true,
      ["sign", "verify"],
    );
    const privateJwk = (await crypto.subtle.exportKey(
      "jwk",
      keyPair.privateKey,
    )) as JsonWebKey;
    const spki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));
    const publicKey = toBase64Url(spki);
    // Canonical v3 identity id: full sha256 hex of SPKI bytes.
    const deviceId = await sha256Hex(spki);
    const doc: StoredDeviceIdentityV2 = {
      version: 2,
      alg: "Ed25519",
      deviceId,
      publicKey,
      privateJwk,
      createdAt: Date.now(),
    };
    try {
      window.localStorage.setItem(
        OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V2,
        JSON.stringify(doc),
      );
      // Ensure legacy identity won't be reused accidentally.
      window.localStorage.removeItem(OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V1);
    } catch {
      // ignore storage failures
    }
    return {
      deviceId,
      publicKey,
      sign: async (message: Uint8Array) => {
        const sig = await crypto.subtle.sign(
          { name: "Ed25519" },
          keyPair.privateKey,
          toArrayBuffer(message),
        );
        return toBase64Url(new Uint8Array(sig));
      },
    };
  } catch {
    return null;
  }
}

export async function buildDeviceProofV3(challengeNonce: string): Promise<{
  device: {
    id: string;
    publicKey: string;
    signedAt: number;
    signature: string;
    nonce: string;
  };
} | null> {
  const identity = await ensureDeviceIdentityV3();
  if (!identity) return null;
  const signedAt = Date.now();
  const signature = await identity.sign(toUtf8Bytes(challengeNonce));
  return {
    device: {
      id: identity.deviceId,
      publicKey: identity.publicKey,
      signedAt,
      signature,
      nonce: challengeNonce,
    },
  };
}
