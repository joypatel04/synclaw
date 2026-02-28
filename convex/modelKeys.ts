import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "./lib/permissions";
import { decryptSecretFromHex, encryptSecretToHex } from "./lib/secretCrypto";

const AUTH_MODE = "api_key_only" as const;
const AUTH_GUARD_MESSAGE = "OAuth/login provider adapters are not enabled.";

const providerValidator = v.union(
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("gemini"),
  v.literal("google_antigravity"),
  v.literal("z_ai"),
  v.literal("minimax"),
);

export const upsertWorkspaceKey = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider: providerValidator,
    key: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const keyValue = args.key.trim();
    if (!keyValue) throw new Error("Provider key is required.");
    const enc = await encryptSecretToHex(keyValue);
    const now = Date.now();
    const existing = await ctx.db
      .query("workspaceModelProviderKeys")
      .withIndex("byWorkspaceAndProvider", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("provider", args.provider),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label?.trim() || existing.label,
        keyCiphertextHex: enc.ciphertextHex,
        keyIvHex: enc.ivHex,
        status: "untested",
        lastValidatedAt: undefined,
        updatedAt: now,
        updatedBy: membership.userId,
      } as any);
      return {
        ok: true,
        provider: args.provider,
        status: "untested" as const,
        authMode: AUTH_MODE,
        guardMessage: AUTH_GUARD_MESSAGE,
      };
    }
    await ctx.db.insert("workspaceModelProviderKeys", {
      workspaceId: args.workspaceId,
      provider: args.provider,
      label: args.label?.trim() || undefined,
      keyCiphertextHex: enc.ciphertextHex,
      keyIvHex: enc.ivHex,
      status: "untested",
      updatedAt: now,
      updatedBy: membership.userId,
    });
    return {
      ok: true,
      provider: args.provider,
      status: "untested" as const,
      authMode: AUTH_MODE,
      guardMessage: AUTH_GUARD_MESSAGE,
    };
  },
});

export const listWorkspaceKeyStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("workspaceModelProviderKeys")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return rows.map((row) => ({
      provider: row.provider,
      label: row.label ?? "",
      status: row.status,
      lastValidatedAt: row.lastValidatedAt ?? null,
      updatedAt: row.updatedAt,
      authMode: AUTH_MODE,
      guardMessage: AUTH_GUARD_MESSAGE,
    }));
  },
});

export const validateWorkspaceKeys = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const rows = await ctx.db
      .query("workspaceModelProviderKeys")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const now = Date.now();
    const results: Array<{ provider: string; status: "valid" | "invalid" }> = [];
    for (const row of rows) {
      const value = await decryptSecretFromHex(row.keyCiphertextHex, row.keyIvHex);
      const valid = value.trim().length >= 16;
      const status = valid ? "valid" : "invalid";
      await ctx.db.patch(row._id, {
        status,
        lastValidatedAt: now,
        updatedAt: now,
        updatedBy: membership.userId,
      });
      results.push({ provider: row.provider, status });
    }
    return {
      ok: true,
      results,
      authMode: AUTH_MODE,
      guardMessage: AUTH_GUARD_MESSAGE,
    };
  },
});
