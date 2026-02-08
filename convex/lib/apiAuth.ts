/**
 * API Key authentication helpers for server-to-server auth.
 * Keys are hashed with SHA-256 before storage — the plaintext key
 * is only shown once at creation time.
 */

/**
 * Hash an API key using SHA-256 (Web Crypto API, available in Convex runtime).
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a random API key with the `sk_` prefix.
 * Returns a 51-char key: "sk_" + 48 hex chars (192 bits of entropy).
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(24); // 24 bytes = 48 hex chars
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sk_${hex}`;
}

/**
 * Extract the display prefix from an API key: "sk_a1b2c3d4..."
 */
export function getKeyPrefix(key: string): string {
  return key.slice(0, 12) + "...";
}
