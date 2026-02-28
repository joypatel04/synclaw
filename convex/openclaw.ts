import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "./lib/permissions";
import { decryptSecretFromHex, encryptSecretToHex } from "./lib/secretCrypto";

const transportModeValidator = v.union(
  v.literal("direct_ws"),
  v.literal("connector"),
  v.literal("self_hosted_local"),
);

type TransportMode = "direct_ws" | "connector" | "self_hosted_local";

function normalizeScopes(scopes: string[], role?: string): string[] {
  const out = new Set(scopes.map((s) => s.trim()).filter(Boolean));

  if (out.size === 0) {
    out.add("operator.read");
    out.add("operator.write");
  }

  // Newer OpenClaw gateway versions may require admin scope for operator flows.
  if ((role ?? "operator") === "operator") {
    out.add("operator.admin");
  }

  return Array.from(out);
}

function validateWsUrl(input: string): string {
  const wsUrl = input.trim();
  if (!wsUrl) throw new Error("wsUrl is required");
  if (!/^wss?:\/\//i.test(wsUrl)) {
    throw new Error('wsUrl must start with "ws://" or "wss://"');
  }
  return wsUrl;
}

function normalizeTransportMode(input?: string): TransportMode {
  if (input === "connector" || input === "self_hosted_local") return input;
  return "direct_ws";
}

function validateHttpUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) {
    throw new Error(
      'filesBridgeBaseUrl must start with "http://" or "https://"',
    );
  }
  return value.replace(/\/+$/, "");
}

export const getConfigSummary = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const row = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!row) return null;

    return {
      transportMode: normalizeTransportMode(row.transportMode),
      connectorId: row.connectorId ?? "",
      connectorStatus: row.connectorStatus ?? "offline",
      connectorLastSeenAt: row.connectorLastSeenAt ?? null,
      wsUrl: row.wsUrl,
      protocol: row.protocol,
      clientId: row.clientId,
      clientMode: row.clientMode,
      clientPlatform: row.clientPlatform,
      role: row.role,
      scopes: normalizeScopes(row.scopes, row.role),
      subscribeOnConnect: row.subscribeOnConnect,
      subscribeMethod: row.subscribeMethod,
      includeCron: row.includeCron,
      historyPollMs: row.historyPollMs,
      filesBridgeEnabled: Boolean(row.filesBridgeEnabled),
      filesBridgeBaseUrl: row.filesBridgeBaseUrl ?? "",
      filesBridgeRootPath: row.filesBridgeRootPath ?? "",
      hasFilesBridgeToken: Boolean(
        row.filesBridgeTokenCiphertextHex && row.filesBridgeTokenIvHex,
      ),
      hasAuthToken: Boolean(row.authTokenCiphertextHex && row.authTokenIvHex),
      hasPassword: Boolean(row.passwordCiphertextHex && row.passwordIvHex),
      updatedAt: row.updatedAt,
    };
  },
});

export const getClientConfig = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Member+ can use chat (direct WS) because the token will be exposed in the
    // browser connection. Viewers should not be able to fetch it.
    await requireRole(ctx, args.workspaceId, "member");

    const row = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!row) return null;

    const authToken =
      row.authTokenCiphertextHex && row.authTokenIvHex
        ? await decryptSecretFromHex(
            row.authTokenCiphertextHex,
            row.authTokenIvHex,
          )
        : undefined;

    const password =
      row.passwordCiphertextHex && row.passwordIvHex
        ? await decryptSecretFromHex(
            row.passwordCiphertextHex,
            row.passwordIvHex,
          )
        : undefined;

    return {
      transportMode: normalizeTransportMode(row.transportMode),
      connectorId: row.connectorId ?? "",
      connectorStatus: row.connectorStatus ?? "offline",
      connectorLastSeenAt: row.connectorLastSeenAt ?? null,
      wsUrl: row.wsUrl,
      protocol: row.protocol,
      authToken,
      password,
      clientId: row.clientId,
      clientMode: row.clientMode,
      clientPlatform: row.clientPlatform,
      role: row.role,
      scopes: normalizeScopes(row.scopes, row.role),
      subscribeOnConnect: row.subscribeOnConnect,
      subscribeMethod: row.subscribeMethod,
      includeCron: row.includeCron,
      historyPollMs: row.historyPollMs,
      filesBridgeEnabled: Boolean(row.filesBridgeEnabled),
      filesBridgeBaseUrl: row.filesBridgeBaseUrl ?? "",
      filesBridgeRootPath: row.filesBridgeRootPath ?? "",
    };
  },
});

export const upsertConfig = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    wsUrl: v.string(),
    transportMode: v.optional(transportModeValidator),
    connectorId: v.optional(v.string()),
    connectorStatus: v.optional(
      v.union(v.literal("online"), v.literal("offline"), v.literal("degraded")),
    ),
    connectorLastSeenAt: v.optional(v.union(v.number(), v.null())),
    protocol: v.union(v.literal("req"), v.literal("jsonrpc")),
    clientId: v.string(),
    clientMode: v.string(),
    clientPlatform: v.string(),
    role: v.string(),
    scopes: v.array(v.string()),
    subscribeOnConnect: v.boolean(),
    subscribeMethod: v.string(),
    includeCron: v.boolean(),
    historyPollMs: v.number(),
    filesBridgeEnabled: v.optional(v.boolean()),
    filesBridgeBaseUrl: v.optional(v.string()),
    filesBridgeRootPath: v.optional(v.string()),
    filesBridgeToken: v.optional(v.union(v.string(), v.null())),
    authToken: v.optional(v.union(v.string(), v.null())),
    password: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");

    const now = Date.now();
    const transportMode = normalizeTransportMode(args.transportMode);
    const wsUrlRaw = args.wsUrl.trim();
    const wsUrl =
      transportMode === "connector" ? wsUrlRaw : validateWsUrl(args.wsUrl);
    if (
      transportMode === "connector" &&
      args.connectorId !== undefined &&
      !args.connectorId.trim()
    ) {
      throw new Error("connectorId is required for connector transport mode");
    }
    const scopes = normalizeScopes(args.scopes, args.role);

    const existing = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    // Handle secrets: undefined = keep, null = clear, string = replace.
    const secretPatch: Record<string, string | undefined | null> = {};

    if (args.authToken !== undefined) {
      if (args.authToken === null || args.authToken.trim() === "") {
        secretPatch.authTokenCiphertextHex = undefined;
        secretPatch.authTokenIvHex = undefined;
      } else {
        const enc = await encryptSecretToHex(args.authToken);
        secretPatch.authTokenCiphertextHex = enc.ciphertextHex;
        secretPatch.authTokenIvHex = enc.ivHex;
      }
    }

    if (args.password !== undefined) {
      if (args.password === null || args.password.trim() === "") {
        secretPatch.passwordCiphertextHex = undefined;
        secretPatch.passwordIvHex = undefined;
      } else {
        const enc = await encryptSecretToHex(args.password);
        secretPatch.passwordCiphertextHex = enc.ciphertextHex;
        secretPatch.passwordIvHex = enc.ivHex;
      }
    }

    if (args.filesBridgeToken !== undefined) {
      if (
        args.filesBridgeToken === null ||
        args.filesBridgeToken.trim() === ""
      ) {
        secretPatch.filesBridgeTokenCiphertextHex = undefined;
        secretPatch.filesBridgeTokenIvHex = undefined;
      } else {
        const enc = await encryptSecretToHex(args.filesBridgeToken);
        secretPatch.filesBridgeTokenCiphertextHex = enc.ciphertextHex;
        secretPatch.filesBridgeTokenIvHex = enc.ivHex;
      }
    }

    const nextFilesBridgeEnabled =
      args.filesBridgeEnabled ?? existing?.filesBridgeEnabled ?? false;
    const nextFilesBridgeBaseUrl =
      args.filesBridgeBaseUrl !== undefined
        ? validateHttpUrl(args.filesBridgeBaseUrl)
        : (existing?.filesBridgeBaseUrl ?? "");
    const nextFilesBridgeRootPath =
      args.filesBridgeRootPath !== undefined
        ? (args.filesBridgeRootPath ?? "").trim()
        : (existing?.filesBridgeRootPath ?? "");

    const base = {
      workspaceId: args.workspaceId,
      wsUrl,
      transportMode,
      connectorId:
        args.connectorId !== undefined
          ? args.connectorId.trim()
          : (existing?.connectorId ?? ""),
      connectorStatus:
        args.connectorStatus ?? existing?.connectorStatus ?? "offline",
      connectorLastSeenAt:
        args.connectorLastSeenAt === null
          ? undefined
          : (args.connectorLastSeenAt ??
            existing?.connectorLastSeenAt ??
            undefined),
      protocol: args.protocol,
      clientId: args.clientId || "openclaw-control-ui",
      clientMode: args.clientMode || "webchat",
      clientPlatform: args.clientPlatform || "web",
      role: args.role || "operator",
      scopes,
      subscribeOnConnect: args.subscribeOnConnect,
      subscribeMethod: args.subscribeMethod || "chat.subscribe",
      includeCron: args.includeCron,
      historyPollMs: Math.max(0, Math.floor(args.historyPollMs)),
      filesBridgeEnabled: nextFilesBridgeEnabled,
      filesBridgeBaseUrl: nextFilesBridgeBaseUrl,
      filesBridgeRootPath: nextFilesBridgeRootPath,
      updatedAt: now,
      updatedBy: membership.userId,
    };

    if (!existing) {
      const doc = {
        ...base,
        createdAt: now,
        ...secretPatch,
      };
      await ctx.db.insert("openclawGatewayConfigs", doc as any);
      return { ok: true };
    }

    // Convex `patch` supports deleting optional fields by setting them to
    // `undefined`, which we use for the "clear token/password" behavior.
    await ctx.db.patch(existing._id, {
      ...base,
      ...secretPatch,
    } as any);

    return { ok: true };
  },
});
