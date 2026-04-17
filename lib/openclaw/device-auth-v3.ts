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
  "synclaw:openclaw:deviceIdentity:v2";
export const OPENCLAW_DEVICE_IDENTITY_STORAGE_KEY_V1 =
  "synclaw:openclaw:deviceIdentity:v1";

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

function fromBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function deriveRawEd25519PublicKeyFromSpki(spkiB64u: string): Uint8Array | null {
  const spki = fromBase64Url(spkiB64u);
  // Ed25519 SPKI DER layout ends with 32-byte raw pubkey.
  if (spki.length < 32) return null;
  return spki.slice(spki.length - 32);
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
  deviceAuthPayload: string;
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
    deviceAuthPayload: challengeNonce,
    device: {
      id: identity.deviceId,
      publicKey: identity.publicKey,
      signedAt,
      signature,
      nonce: challengeNonce,
    },
  };
}

export function buildDeviceAuthPayloadV3(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce?: string | null;
  version?: "v1" | "v2";
}): string {
  const version = params.version ?? (params.nonce ? "v2" : "v1");
  const scopes = params.scopes
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
  const token = params.token ?? "";
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
  ];
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }
  return base.join("|");
}

export type DeviceProofVariant =
  | "v2_spki_token"
  | "v2_spki_notoken"
  | "v2_raw_token"
  | "v2_raw_notoken"
  | "nonce_spki";

export async function buildDeviceProofForConnectV3(params: {
  challengeNonce: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  token?: string | null;
  variant?: DeviceProofVariant;
}): Promise<{
  variant: DeviceProofVariant;
  deviceAuthPayload: string;
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
  const variant = params.variant ?? "v2_spki_token";
  const signedAt = Date.now();
  const raw = deriveRawEd25519PublicKeyFromSpki(identity.publicKey);
  const rawB64u = raw ? toBase64Url(raw) : null;
  const rawId = raw ? await sha256Hex(raw) : null;

  const useRaw = variant === "v2_raw_token" || variant === "v2_raw_notoken";
  const publicKey = useRaw && rawB64u ? rawB64u : identity.publicKey;
  const deviceId = useRaw && rawId ? rawId : identity.deviceId;
  const token =
    variant === "v2_spki_notoken" || variant === "v2_raw_notoken"
      ? ""
      : (params.token ?? "");

  const deviceAuthPayload =
    variant === "nonce_spki"
      ? params.challengeNonce
      : buildDeviceAuthPayloadV3({
          version: "v2",
          deviceId,
          clientId: params.clientId,
          clientMode: params.clientMode,
          role: params.role,
          scopes: params.scopes,
          signedAtMs: signedAt,
          token,
          nonce: params.challengeNonce,
        });
  const signature = await identity.sign(toUtf8Bytes(deviceAuthPayload));
  return {
    variant,
    deviceAuthPayload,
    device: {
      id: deviceId,
      publicKey,
      signedAt,
      signature,
      nonce: params.challengeNonce,
    },
  };
}
