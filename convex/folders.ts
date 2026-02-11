import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "./lib/permissions";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    return await ctx.db
      .query("folders")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("asc")
      .collect();
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent || parent.workspaceId !== args.workspaceId) {
        throw new Error("Parent folder not found");
      }
    }
    return await ctx.db.insert("folders", {
      workspaceId: args.workspaceId,
      name: args.name.trim(),
      parentId: args.parentId,
      icon: args.icon,
    });
  },
});
