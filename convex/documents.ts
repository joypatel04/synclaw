import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireMember } from "./lib/permissions";

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("note"),
    ),
    taskId: v.union(v.id("tasks"), v.null()),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");
    return await ctx.db.insert("documents", {
      workspaceId: args.workspaceId,
      title: args.title,
      content: args.content,
      type: args.type,
      taskId: args.taskId,
      agentId: args.agentId,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.optional(
      v.union(
        v.literal("deliverable"),
        v.literal("research"),
        v.literal("protocol"),
        v.literal("note"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const docs = await ctx.db
      .query("documents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    return args.type ? docs.filter((d) => d.type === args.type) : docs;
  },
});

export const getByTask = query({
  args: { workspaceId: v.id("workspaces"), taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    return await ctx.db
      .query("documents")
      .withIndex("byTask", (q) => q.eq("taskId", args.taskId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { workspaceId: v.id("workspaces"), id: v.id("documents") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.workspaceId !== args.workspaceId) return null;
    return doc;
  },
});
