import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "./lib/permissions";
import { decryptSecretFromHex, encryptSecretToHex } from "./lib/secretCrypto";

function normalizeScopes(scopes: string[], role?: string): string[] {
  const out = new Set(
    scopes
      .map((s) => s.trim())
      .filter(Boolean),
  );

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
    };
  },
});

export const upsertConfig = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    wsUrl: v.string(),
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
    authToken: v.optional(v.union(v.string(), v.null())),
    password: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");

    const now = Date.now();
    const wsUrl = validateWsUrl(args.wsUrl);
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

    const base = {
      workspaceId: args.workspaceId,
      wsUrl,
      protocol: args.protocol,
      clientId: args.clientId || "cli",
      clientMode: args.clientMode || "webchat",
      clientPlatform: args.clientPlatform || "web",
      role: args.role || "operator",
      scopes,
      subscribeOnConnect: args.subscribeOnConnect,
      subscribeMethod: args.subscribeMethod || "chat.subscribe",
      includeCron: args.includeCron,
      historyPollMs: Math.max(0, Math.floor(args.historyPollMs)),
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
