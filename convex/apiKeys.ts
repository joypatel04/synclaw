import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/permissions";
import { hashApiKey, generateApiKey, getKeyPrefix } from "./lib/apiAuth";
import { canUseFeature } from "./lib/billing";
import { isCommercialCapabilityEnabled } from "./lib/edition";

// ─── Queries ──────────────────────────────────────────────────────

/** List API keys for a workspace (owner only). Never returns the full key. */
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "owner");
    const keys = await ctx.db
      .query("workspaceApiKeys")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return keys.map((k) => ({
      _id: k._id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      role: k.role,
      isActive: k.isActive,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }));
  },
});

// ─── Mutations ────────────────────────────────────────────────────

/** Create a new API key (owner only). Returns the full key ONCE. */
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    const billingEnabled = isCommercialCapabilityEnabled("billing");
    if (billingEnabled && !canUseFeature(workspace, "api_keys")) {
      throw new Error(
        "API keys are available on Starter/Pro plans. Upgrade in Settings -> Billing.",
      );
    }

    // Generate the API key
    const plainKey = generateApiKey();
    const keyHash = await hashApiKey(plainKey);
    const keyPrefix = getKeyPrefix(plainKey);

    // Create a bot user in the users table
    const botUserId = await ctx.db.insert("users", {
      name: `Bot: ${args.name}`,
      email: null,
      image: null,
    });

    // Add the bot user as a workspace member with the chosen role
    await ctx.db.insert("workspaceMembers", {
      workspaceId: args.workspaceId,
      userId: botUserId,
      role: args.role,
      joinedAt: Date.now(),
    });

    // Store the API key (hashed)
    await ctx.db.insert("workspaceApiKeys", {
      workspaceId: args.workspaceId,
      name: args.name,
      keyPrefix,
      keyHash,
      role: args.role,
      botUserId,
      createdBy: membership.userId,
      createdAt: Date.now(),
      isActive: true,
    });

    // Return the plaintext key — this is the only time it's visible
    return { key: plainKey, prefix: keyPrefix };
  },
});

/** Revoke an API key (owner only). Deactivates the key and removes the bot user from workspace. */
export const revoke = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    keyId: v.id("workspaceApiKeys"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "owner");

    const apiKey = await ctx.db.get(args.keyId);
    if (!apiKey || apiKey.workspaceId !== args.workspaceId) {
      throw new Error("API key not found");
    }

    // Deactivate the key
    await ctx.db.patch(args.keyId, { isActive: false });

    // Remove the bot user's workspace membership
    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspaceAndUser", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", apiKey.botUserId),
      )
      .first();

    if (membership) {
      await ctx.db.delete(membership._id);
    }
  },
});

// ─── Internal (called by HTTP actions) ────────────────────────────

/** Validate an API key hash and return the key record. Used by the token exchange endpoint. */
export const validateByHash = internalMutation({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("workspaceApiKeys")
      .withIndex("byKeyHash", (q) => q.eq("keyHash", args.keyHash))
      .first();

    if (!apiKey || !apiKey.isActive) return null;

    // Update lastUsedAt
    await ctx.db.patch(apiKey._id, { lastUsedAt: Date.now() });

    return {
      workspaceId: apiKey.workspaceId,
      botUserId: apiKey.botUserId,
      role: apiKey.role,
      name: apiKey.name,
    };
  },
});
