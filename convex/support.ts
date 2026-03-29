import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "./lib/permissions";
import { requireEnabledCapability } from "./lib/edition";

export const createAssistedSession = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    ownerContact: v.string(),
    notes: v.optional(v.string()),
    preferredTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireEnabledCapability("assistedLaunch");
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const now = Date.now();
    const sessionId = await ctx.db.insert("openclawSupportSessions", {
      workspaceId: args.workspaceId,
      type: "assisted_launch",
      status: "requested",
      ownerContact: args.ownerContact.trim(),
      notes: args.notes?.trim() || undefined,
      preferredTime: args.preferredTime?.trim() || undefined,
      createdBy: membership.userId,
      createdAt: now,
      updatedAt: now,
    });

    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        serviceTier: "assisted",
        ownerContact: args.ownerContact.trim(),
        supportNotes: args.notes?.trim() || cfg.supportNotes || "",
        updatedAt: now,
        updatedBy: membership.userId,
      });
    }

    return { ok: true, sessionId };
  },
});

export const listAssistedSessions = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    requireEnabledCapability("assistedLaunch");
    await requireMember(ctx, args.workspaceId);
    return await ctx.db
      .query("openclawSupportSessions")
      .withIndex("byWorkspaceAndCreatedAt", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .take(20);
  },
});
