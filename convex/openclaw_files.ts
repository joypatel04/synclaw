import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".config",
];

function normalizeRelativePath(input?: string): string {
  const raw = (input ?? ".").trim();
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new Error("Path traversal is not allowed");
  }
  return normalized || ".";
}

function assertTextExtension(path: string) {
  const lower = path.toLowerCase();
  const ok = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!ok) {
    throw new Error(
      `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }
}

function parseBridgeResponse(status: number, text: string): never {
  let message = `Bridge request failed (${status})`;
  try {
    const json = JSON.parse(text) as { error?: string; message?: string };
    message = json.error ?? json.message ?? message;
  } catch {
    if (text.trim().length > 0) message = text.slice(0, 240);
  }
  throw new Error(message);
}

async function fetchBridge(args: {
  url: string;
  token: string;
  method?: "GET" | "PUT";
  body?: Record<string, unknown>;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(args.url, {
      method: args.method ?? "GET",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": "application/json",
      },
      body: args.body ? JSON.stringify(args.body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) parseBridgeResponse(response.status, text);
    return text.trim().length > 0 ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
}

type BridgeConfig = {
  baseUrl: string;
  rootPath: string;
  token: string;
};

async function getBridgeConfig(
  ctx: any,
  workspaceId: Id<"workspaces">,
): Promise<BridgeConfig> {
  const workspace = await ctx.runQuery(api.workspaces.getById, { workspaceId });
  if (!workspace) throw new Error("Workspace not found or access denied");
  const cfg = await ctx.runQuery((internal as any).openclaw_files_internal.getBridgeConfig, {
    workspaceId,
  });
  if (!cfg) {
    throw new Error("Remote files bridge is not enabled for this workspace");
  }
  if (!cfg.baseUrl) throw new Error("filesBridgeBaseUrl is not configured");
  if (!cfg.token) throw new Error("files bridge token is not configured");
  return cfg as BridgeConfig;
}

export const testBridge = action({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const cfg = await getBridgeConfig(ctx, args.workspaceId);
    const health = await fetchBridge({
      url: `${cfg.baseUrl}/health`,
      token: cfg.token,
    });
    const rootProbe = await fetchBridge({
      url: `${cfg.baseUrl}/v1/tree?path=${encodeURIComponent(".")}`,
      token: cfg.token,
    });
    return {
      ok: true,
      rootPath: cfg.rootPath,
      health,
      rootProbe,
    };
  },
});

export const listTree = action({
  args: {
    workspaceId: v.id("workspaces"),
    path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cfg = await getBridgeConfig(ctx, args.workspaceId);
    const path = normalizeRelativePath(args.path);
    return await fetchBridge({
      url: `${cfg.baseUrl}/v1/tree?path=${encodeURIComponent(path)}`,
      token: cfg.token,
    });
  },
});

export const readFile = action({
  args: {
    workspaceId: v.id("workspaces"),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const cfg = await getBridgeConfig(ctx, args.workspaceId);
    const path = normalizeRelativePath(args.path);
    assertTextExtension(path);
    return await fetchBridge({
      url: `${cfg.baseUrl}/v1/file?path=${encodeURIComponent(path)}`,
      token: cfg.token,
    });
  },
});

export const writeFile = action({
  args: {
    workspaceId: v.id("workspaces"),
    path: v.string(),
    content: v.string(),
    expectedHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cfg = await getBridgeConfig(ctx, args.workspaceId);
    const path = normalizeRelativePath(args.path);
    assertTextExtension(path);
    const size = new TextEncoder().encode(args.content).byteLength;
    if (size > DEFAULT_MAX_FILE_BYTES) {
      throw new Error(`File too large. Max ${DEFAULT_MAX_FILE_BYTES} bytes`);
    }
    return await fetchBridge({
      url: `${cfg.baseUrl}/v1/file`,
      token: cfg.token,
      method: "PUT",
      body: {
        path,
        content: args.content,
        expectedHash: args.expectedHash,
      },
    });
  },
});
