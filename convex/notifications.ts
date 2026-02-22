import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./lib/permissions";

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    mentionedAgentId: v.id("agents"),
    taskId: v.union(v.id("tasks"), v.null()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      workspaceId: args.workspaceId,
      mentionedAgentId: args.mentionedAgentId,
      taskId: args.taskId,
      message: args.message,
      delivered: false,
      createdAt: Date.now(),
    });
  },
});

export const getUndelivered = query({
  args: { workspaceId: v.id("workspaces"), agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    return await ctx.db
      .query("notifications")
      .withIndex("undeliveredForAgent", (q) =>
        q.eq("mentionedAgentId", args.agentId).eq("delivered", false),
      )
      .order("desc")
      .collect();
  },
});

export const markDelivered = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { delivered: true });
  },
});

export const markAllDelivered = mutation({
  args: { workspaceId: v.id("workspaces"), agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const undelivered = await ctx.db
      .query("notifications")
      .withIndex("undeliveredForAgent", (q) =>
        q.eq("mentionedAgentId", args.agentId).eq("delivered", false),
      )
      .collect();
    for (const n of undelivered) {
      await ctx.db.patch(n._id, { delivered: true });
    }
  },
});

export const markDeliveredMany = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    notificationIds: v.array(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    for (const id of args.notificationIds) {
      const row = await ctx.db.get(id);
      if (!row || row.workspaceId !== args.workspaceId) continue;
      if (row.mentionedAgentId !== args.agentId) continue;
      if (row.delivered) continue;
      await ctx.db.patch(id, { delivered: true });
    }
  },
});
