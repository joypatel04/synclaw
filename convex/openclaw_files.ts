import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;
const WRITABLE_TEXT_EXTENSIONS = [
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".config",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
];
const READABLE_BINARY_EXTENSIONS = [".pdf"];
const READABLE_EXTENSIONS = [
  ...WRITABLE_TEXT_EXTENSIONS,
  ...READABLE_BINARY_EXTENSIONS,
];

function normalizeRelativePath(input?: string): string {
  const raw = (input ?? ".").trim();
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new Error("Path traversal is not allowed");
  }
  return normalized || ".";
}

function resolveScopedPath(args: { basePath?: string; path?: string }): {
  scopedBase: string | null;
  requestedPath: string;
  bridgePath: string;
} {
  const requestedPath = normalizeRelativePath(args.path);
  const baseRaw = (args.basePath ?? "").trim();
  if (!baseRaw) {
    return { scopedBase: null, requestedPath, bridgePath: requestedPath };
  }
  const scopedBase = normalizeRelativePath(baseRaw);
  const bridgePath =
    requestedPath === "."
      ? scopedBase
      : normalizeRelativePath(`${scopedBase}/${requestedPath}`);
  return { scopedBase, requestedPath, bridgePath };
}

function toScopedPath(
  bridgePath: string,
  scopedBase: string | null,
  fallbackPath: string,
): string {
  const normalized = normalizeRelativePath(bridgePath || fallbackPath);
  if (!scopedBase) return normalized;
  if (normalized === scopedBase) return ".";
  if (normalized.startsWith(`${scopedBase}/`)) {
    return normalized.slice(scopedBase.length + 1) || ".";
  }
  return normalizeRelativePath(fallbackPath);
}

function assertReadableExtension(path: string) {
  const lower = path.toLowerCase();
  const ok = READABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!ok) {
    throw new Error(
      `Unsupported file type. Allowed: ${READABLE_EXTENSIONS.join(", ")}`,
    );
  }
}

function assertWritableTextExtension(path: string) {
  const lower = path.toLowerCase();
  const ok = WRITABLE_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!ok) {
    throw new Error(
      `Unsupported writable file type. Allowed: ${WRITABLE_TEXT_EXTENSIONS.join(", ")}`,
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
  method?: "GET" | "PUT" | "DELETE";
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
  role: "owner" | "admin" | "member" | "viewer";
};

async function getBridgeConfig(
  ctx: any,
  workspaceId: Id<"workspaces">,
): Promise<BridgeConfig> {
  const workspace = await ctx.runQuery(api.workspaces.getById, { workspaceId });
  if (!workspace) throw new Error("Workspace not found or access denied");
  const cfg = await ctx.runQuery(
    (internal as any).openclaw_files_internal.getBridgeConfig,
    {
      workspaceId,
    },
  );
  if (!cfg) {
    throw new Error("Remote files bridge is not enabled for this workspace");
  }
  if (!cfg.baseUrl) throw new Error("filesBridgeBaseUrl is not configured");
  if (!cfg.token) throw new Error("files bridge token is not configured");
  return {
    ...(cfg as Omit<BridgeConfig, "role">),
    role: workspace.role as BridgeConfig["role"],
  };
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
    basePath: v.optional(v.string()),
    path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cfg = await getBridgeConfig(ctx, args.workspaceId);
    const { scopedBase, requestedPath, bridgePath } = resolveScopedPath({
      basePath: args.basePath,
      path: args.path,
    });
    const result = await fetchBridge({
      url: `${cfg.baseUrl}/v1/tree?path=${encodeURIComponent(bridgePath)}`,
      token: cfg.token,
    });
    const items = Array.isArray((result as any)?.items)
      ? (result as any).items.map((item: any) => ({
          name: String(item?.name ?? ""),
          path: toScopedPath(
            String(item?.path ?? ""),
            scopedBase,
            String(item?.path ?? ""),
          ),
          type: item?.type === "directory" ? "directory" : "file",
          size: typeof item?.size === "number" ? item.size : null,
          mtimeMs: typeof item?.mtimeMs === "number" ? item.mtimeMs : null,
        }))
      : [];
    return {
      path: toScopedPath(
        String((result as any)?.path ?? bridgePath),
        scopedBase,
        requestedPath,
      ),
      items,
    };
  },
});

export const readFile = action({
  args: {
    workspaceId: v.id("workspaces"),
    basePath: v.optional(v.string()),
    path: v.string(),
    allowMissing: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const cfg = await getBridgeConfig(ctx, args.workspaceId);
    const { scopedBase, requestedPath, bridgePath } = resolveScopedPath({
      basePath: args.basePath,
      path: args.path,
    });
    assertReadableExtension(requestedPath);
    let result: any;
    try {
      result = await fetchBridge({
        url: `${cfg.baseUrl}/v1/file?path=${encodeURIComponent(bridgePath)}`,
        token: cfg.token,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (args.allowMissing && /file not found/i.test(message)) {
        return {
          missing: true,
          path: toScopedPath(bridgePath, scopedBase, requestedPath),
          content: "",
          mime: "text/plain",
          encoding: "utf8",
          hash: undefined,
          size: 0,
          mtimeMs: undefined,
        };
      }
      throw error;
    }
    const mime =
      typeof (result as any)?.mime === "string"
        ? (result as any).mime
        : "text/plain";
    const encoding =
      typeof (result as any)?.encoding === "string"
        ? (result as any).encoding
        : "utf8";
    const content =
      encoding === "base64"
        ? String((result as any)?.contentBase64 ?? "")
        : String((result as any)?.content ?? "");
    return {
      missing: false,
      path: toScopedPath(
        String((result as any)?.path ?? bridgePath),
        scopedBase,
        requestedPath,
      ),
      content,
      mime,
      encoding,
      hash:
        typeof (result as any)?.hash === "string"
          ? (result as any).hash
          : undefined,
      size:
        typeof (result as any)?.size === "number" ? (result as any).size : 0,
      mtimeMs:
        typeof (result as any)?.mtimeMs === "number"
          ? (result as any).mtimeMs
          : undefined,
    };
  },
});

export const writeFile = action({
  args: {
    workspaceId: v.id("workspaces"),
    basePath: v.optional(v.string()),
    path: v.string(),
    content: v.string(),
    expectedHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cfg = await getBridgeConfig(ctx, args.workspaceId);
    if (cfg.role !== "owner" && cfg.role !== "admin") {
      throw new Error("Only owner/admin can edit workspace files");
    }
    const { scopedBase, requestedPath, bridgePath } = resolveScopedPath({
      basePath: args.basePath,
      path: args.path,
    });
    assertWritableTextExtension(requestedPath);
    const size = new TextEncoder().encode(args.content).byteLength;
    if (size > DEFAULT_MAX_FILE_BYTES) {
      throw new Error(`File too large. Max ${DEFAULT_MAX_FILE_BYTES} bytes`);
    }
    const result = await fetchBridge({
      url: `${cfg.baseUrl}/v1/file`,
      token: cfg.token,
      method: "PUT",
      body: {
        path: bridgePath,
        content: args.content,
        expectedHash: args.expectedHash,
      },
    });
    return {
      ok: true,
      path: toScopedPath(
        String((result as any)?.path ?? bridgePath),
        scopedBase,
        requestedPath,
      ),
      hash:
        typeof (result as any)?.hash === "string"
          ? (result as any).hash
          : undefined,
      size:
        typeof (result as any)?.size === "number" ? (result as any).size : size,
      mtimeMs:
        typeof (result as any)?.mtimeMs === "number"
          ? (result as any).mtimeMs
          : undefined,
    };
  },
});

export const deleteFile = action({
  args: {
    workspaceId: v.id("workspaces"),
    basePath: v.optional(v.string()),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const cfg = await getBridgeConfig(ctx, args.workspaceId);
    if (cfg.role !== "owner" && cfg.role !== "admin") {
      throw new Error("Only owner/admin can delete workspace files");
    }
    const { scopedBase, requestedPath, bridgePath } = resolveScopedPath({
      basePath: args.basePath,
      path: args.path,
    });
    assertReadableExtension(requestedPath);
    const result = await fetchBridge({
      url: `${cfg.baseUrl}/v1/file?path=${encodeURIComponent(bridgePath)}`,
      token: cfg.token,
      method: "DELETE",
    });
    return {
      ok: true,
      path: toScopedPath(
        String((result as any)?.path ?? bridgePath),
        scopedBase,
        requestedPath,
      ),
    };
  },
});
