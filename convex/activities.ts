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
  v.literal("document_created"),
  v.literal("document_updated"),
  v.literal("webhook_event"),
);

function isRelevantActivity(activity: { type: string; metadata?: any }) {
  // Status transitions are high-volume noise for both UI feeds and agent wake cycles.
  // Keep task/doc/comment/broadcast/mention activity as the primary signal.
  if (activity.type === "agent_status") return false;
  if (activity.type === "webhook_event") return false;
  if (
    activity.type === "task_created" &&
    activity.metadata?.action === "workspace_created"
  ) {
    return false;
  }
  return true;
}

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

    // Use compound index to push the 7-day window into the DB query.
    // Overfetch by 3x to account for isRelevantActivity filtering noise.
    const activities = await ctx.db
      .query("activities")
      .withIndex("byWorkspaceCreatedAt", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("createdAt", sevenDaysAgo),
      )
      .order("desc")
      .take(limit * 3);

    return activities.filter((a) => isRelevantActivity(a)).slice(0, limit);
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
    // Default to 7-day window if no `since` provided.
    const floor = args.since ?? Date.now() - 7 * 24 * 60 * 60 * 1000;

    const activities = await ctx.db
      .query("activities")
      .withIndex("byWorkspaceCreatedAt", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("createdAt", floor),
      )
      .order("desc")
      .take(limit * 5);

    return activities
      .filter((activity) => {
        if (!isRelevantActivity(activity)) return false;
        if (args.agentId && activity.agentId !== args.agentId) return false;
        if (typeSet && !typeSet.has(activity.type)) return false;
        if (args.taskId && activity.taskId !== args.taskId) return false;
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
    const floor = args.since ?? Date.now() - 7 * 24 * 60 * 60 * 1000;

    const activities = await ctx.db
      .query("activities")
      .withIndex("byWorkspaceCreatedAt", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("createdAt", floor),
      )
      .order("desc")
      .take(limit * 5);

    return activities
      .filter((activity) => {
        if (activity.type !== "message_sent") return false;
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

    // Push watermark filter into DB using compound index.
    // Order asc (oldest-first) so agents catch up in chronological order.
    // Cap at 200 to bound bandwidth — agents with a recent watermark read near-zero rows.
    const candidates = await ctx.db
      .query("activities")
      .withIndex("byWorkspaceCreatedAt", (q) =>
        q.eq("workspaceId", args.workspaceId).gt("createdAt", watermark),
      )
      .order("asc")
      .take(200);

    if (candidates.length === 0) return [];

    // Only fetch explicitly-acknowledged records when there are candidates.
    // Cap at 500 to prevent unbounded growth of activitySeenByAgent from causing regression.
    const specificallySeen = await ctx.db
      .query("activitySeenByAgent")
      .withIndex("byWorkspaceAgent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("agentId", args.agentId),
      )
      .take(500);
    const seenIds = new Set(specificallySeen.map((row) => row.activityId));

    return candidates.filter((a) => isRelevantActivity(a) && !seenIds.has(a._id));
  },
});

/** Acknowledge specific activities as seen for an agent (member+). */
export const ackSpecific = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    activityIds: v.array(v.id("activities")),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);

    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }

    const now = Date.now();
    for (const activityId of args.activityIds) {
      const activity = await ctx.db.get(activityId);
      if (!activity || activity.workspaceId !== args.workspaceId) continue;
      if (!isRelevantActivity(activity)) continue;

      const existing = await ctx.db
        .query("activitySeenByAgent")
        .withIndex("byAgentActivity", (q) =>
          q.eq("agentId", args.agentId).eq("activityId", activityId),
        )
        .first();

      if (existing) {
        if (existing.seenAt < now) {
          await ctx.db.patch(existing._id, { seenAt: now });
        }
      } else {
        await ctx.db.insert("activitySeenByAgent", {
          workspaceId: args.workspaceId,
          agentId: args.agentId,
          activityId,
          seenAt: now,
        });
      }
    }
  },
});
