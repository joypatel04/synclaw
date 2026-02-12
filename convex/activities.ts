import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMember } from "./lib/permissions";

const activityType = v.union(
  v.literal("task_created"),
  v.literal("task_updated"),
  v.literal("message_sent"),
  v.literal("agent_status"),
  v.literal("broadcast_sent"),
  v.literal("mention_alert"),
);

/** Log an activity (internal use, no direct auth check). */
export const log = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: activityType,
    agentId: v.union(v.id("agents"), v.null()),
    taskId: v.union(v.id("tasks"), v.null()),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: args.type,
      agentId: args.agentId,
      taskId: args.taskId,
      message: args.message,
      metadata: args.metadata ?? {},
      createdAt: Date.now(),
    });
  },
});

/** Get recent activities for a workspace (viewer+). */
export const recent = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const limit = args.limit ?? 50;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const activities = await ctx.db
      .query("activities")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    return activities
      .filter((a) => a.createdAt >= sevenDaysAgo)
      .slice(0, limit);
  },
});

/** Get activities with optional filters (viewer+). */
export const getByAgent = query({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.optional(v.id("agents")),
    types: v.optional(v.array(activityType)),
    taskId: v.optional(v.id("tasks")),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const limit = args.limit ?? 50;
    const typeSet = args.types ? new Set(args.types) : null;

    const activities = await ctx.db
      .query("activities")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    return activities
      .filter((activity) => {
        if (args.agentId && activity.agentId !== args.agentId) return false;
        if (typeSet && !typeSet.has(activity.type)) return false;
        if (args.taskId && activity.taskId !== args.taskId) return false;
        if (args.since !== undefined && activity.createdAt < args.since)
          return false;
        return true;
      })
      .slice(0, limit);
  },
});

/** Get activities where the given agent was mentioned (viewer+). */
export const getWithMention = query({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const limit = args.limit ?? 50;

    const activities = await ctx.db
      .query("activities")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    return activities
      .filter((activity) => {
        if (activity.type !== "message_sent") return false;
        if (args.since !== undefined && activity.createdAt < args.since)
          return false;

        const mentionedAgentIds = activity.metadata?.mentionedAgentIds;
        return (
          Array.isArray(mentionedAgentIds) &&
          mentionedAgentIds.includes(args.agentId)
        );
      })
      .slice(0, limit);
  },
});

/** Get unseen activities for an agent since its last acknowledgment (member+). */
export const getUnseen = query({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }

    const watermark = agent.lastSeenActivityAt ?? 0;

    const activities = await ctx.db
      .query("activities")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    // Filter to only unseen, then reverse to chronological order (oldest first)
    return activities.filter((a) => a.createdAt > watermark).reverse();
  },
});
