import { z } from "zod";

const EnvSchema = z.object({
  OPENCLAW_GATEWAY_WS_URL: z.string().min(1),
  OPENCLAW_GATEWAY_PROTOCOL: z
    .enum(["req", "jsonrpc"])
    .optional(),
  OPENCLAW_GATEWAY_ORIGIN: z.string().optional(),
  OPENCLAW_GATEWAY_CLIENT_ID: z.string().optional(),
  OPENCLAW_GATEWAY_CLIENT_MODE: z.string().optional(),
  OPENCLAW_GATEWAY_CLIENT_PLATFORM: z.string().optional(),
  OPENCLAW_GATEWAY_ROLE: z.string().optional(),
  OPENCLAW_GATEWAY_SCOPES: z.string().optional(),
  OPENCLAW_GATEWAY_AUTH_TOKEN: z.string().optional(),
  OPENCLAW_GATEWAY_PASSWORD: z.string().optional(),
  OPENCLAW_GATEWAY_CHAT_SUBSCRIBE: z.string().optional(),
  BRIDGE_WORKER_ID: z.string().default("openclaw-bridge-1"),
  BRIDGE_POLL_INTERVAL_MS: z.coerce.number().default(1500),
  BRIDGE_BATCH_SIZE: z.coerce.number().default(20),
  BRIDGE_RECONNECT_MIN_MS: z.coerce.number().default(1000),
  BRIDGE_RECONNECT_MAX_MS: z.coerce.number().default(15000),
  CONVEX_URL: z.string().min(1),
  CONVEX_SITE_URL: z.string().min(1),
  SUTRAHA_API_KEY: z.string().min(1),
  SUTRAHA_WORKSPACE_ID: z.string().min(1),
});

export type BridgeConfig = {
  gatewayWsUrl: string;
  gatewayProtocol: "req" | "jsonrpc";
  gatewayOrigin?: string;
  gatewayClientId: string;
  gatewayClientMode: string;
  gatewayClientPlatform: string;
  gatewayRole: string;
  gatewayScopes: string[];
  gatewayAuthToken?: string;
  gatewayPassword?: string;
  subscribeOnConnect: boolean;
  workerId: string;
  pollIntervalMs: number;
  batchSize: number;
  reconnectMinMs: number;
  reconnectMaxMs: number;
  convexUrl: string;
  convexSiteUrl: string;
  sutrahaApiKey: string;
  workspaceId: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const parsed = EnvSchema.parse(env);
  return {
    gatewayWsUrl: parsed.OPENCLAW_GATEWAY_WS_URL,
    gatewayProtocol: parsed.OPENCLAW_GATEWAY_PROTOCOL ?? "req",
    gatewayOrigin: parsed.OPENCLAW_GATEWAY_ORIGIN,
    gatewayClientId: parsed.OPENCLAW_GATEWAY_CLIENT_ID ?? "cli",
    gatewayClientMode: parsed.OPENCLAW_GATEWAY_CLIENT_MODE ?? "operator",
    gatewayClientPlatform: parsed.OPENCLAW_GATEWAY_CLIENT_PLATFORM ?? "node",
    gatewayRole: parsed.OPENCLAW_GATEWAY_ROLE ?? "operator",
    gatewayScopes: (parsed.OPENCLAW_GATEWAY_SCOPES ?? "operator.read,operator.write")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    gatewayAuthToken: parsed.OPENCLAW_GATEWAY_AUTH_TOKEN,
    gatewayPassword: parsed.OPENCLAW_GATEWAY_PASSWORD,
    subscribeOnConnect:
      parsed.OPENCLAW_GATEWAY_CHAT_SUBSCRIBE !== "false" &&
      parsed.OPENCLAW_GATEWAY_CHAT_SUBSCRIBE !== "0",
    workerId: parsed.BRIDGE_WORKER_ID,
    pollIntervalMs: parsed.BRIDGE_POLL_INTERVAL_MS,
    batchSize: parsed.BRIDGE_BATCH_SIZE,
    reconnectMinMs: parsed.BRIDGE_RECONNECT_MIN_MS,
    reconnectMaxMs: parsed.BRIDGE_RECONNECT_MAX_MS,
    convexUrl: parsed.CONVEX_URL,
    convexSiteUrl: parsed.CONVEX_SITE_URL,
    sutrahaApiKey: parsed.SUTRAHA_API_KEY,
    workspaceId: parsed.SUTRAHA_WORKSPACE_ID,
  };
}
