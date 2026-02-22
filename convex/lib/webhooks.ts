import type { Id } from "../_generated/dataModel";

export type WebhookActionTemplate =
  | "create_task"
  | "create_document"
  | "log_activity"
  | "task_and_nudge_main";

export type WebhookPayloadStatus =
  | "received"
  | "processed"
  | "failed"
  | "ignored";

export type WebhookMappingConfig = {
  titlePath?: string;
  bodyPath?: string;
  priority?: "high" | "medium" | "low" | "none";
  status?: "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked";
};

export const WEBHOOK_MAX_PAYLOAD_BYTES = 262_144;
export const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60_000;
export const WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 60;
export const MAIN_AGENT_SESSION_KEY = "agent:main:main";

export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const asHex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `whsec_${asHex}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyWebhookSecret(
  providedSecret: string,
  secretHash: string,
): Promise<boolean> {
  const computed = await sha256Hex(providedSecret);
  return timingSafeEqual(computed, secretHash);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function sanitizeWebhookHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of headers.entries()) {
    const key = k.toLowerCase();
    if (
      key === "content-type" ||
      key === "user-agent" ||
      key === "x-provider-event-id" ||
      key.startsWith("x-")
    ) {
      out[key] = v;
    }
  }
  return out;
}

export function parseWebhookPayload(
  rawBody: string,
  contentType: string,
): unknown | string {
  const normalized = (contentType || "").toLowerCase();
  const shouldParseJson =
    normalized.includes("application/json") ||
    rawBody.startsWith("{") ||
    rawBody.startsWith("[");
  if (!shouldParseJson) return rawBody;
  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

export function getValueAtPath(input: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return undefined;
  let current: unknown = input;
  for (const segment of segments) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function toDisplayString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export function formatPayloadPreview(payload: unknown): string {
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function isWebhookEventAllowed(filter: string[], eventName: string | null): boolean {
  if (filter.length === 0) return true;
  if (filter.includes("*")) return true;
  if (!eventName) return false;
  return filter.includes(eventName);
}

export function buildWebhookEndpointUrl(
  workspaceId: Id<"workspaces">,
  webhookId: Id<"workspaceWebhooks">,
): string {
  const base =
    process.env.CONVEX_SITE_URL ||
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  const normalizedBase = base.replace(/\/$/, "");
  const query = `workspaceId=${encodeURIComponent(String(workspaceId))}&webhookId=${encodeURIComponent(String(webhookId))}`;
  return `${normalizedBase}/api/v1/workspaces/webhooks/ingest?${query}`;
}

