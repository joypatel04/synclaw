import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireMember, getUserDisplayName } from "./lib/permissions";

/** Create a broadcast (member+). */
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    targetAgentIds: v.union(v.array(v.id("agents")), v.literal("all")),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "member");
    const displayName = await getUserDisplayName(ctx, membership.userId);
    const now = Date.now();

    const broadcastId = await ctx.db.insert("broadcasts", {
      workspaceId: args.workspaceId,
      title: args.title,
      content: args.content,
      targetAgentIds: args.targetAgentIds,
      createdBy: displayName,
      createdAt: now,
      responses: [],
    });

    const targetLabel =
      args.targetAgentIds === "all"
        ? "all agents"
        : `${(args.targetAgentIds as string[]).length} agent(s)`;
    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "broadcast_sent",
      agentId: null,
      taskId: null,
      message: `${displayName} broadcast to ${targetLabel}: "${args.title}"`,
      metadata: { broadcastId },
      createdAt: now,
    });

    // Create notifications for targeted agents
    const agents =
      args.targetAgentIds === "all"
        ? await ctx.db
            .query("agents")
            .withIndex("byWorkspace", (q) =>
              q.eq("workspaceId", args.workspaceId),
            )
            .collect()
        : await Promise.all(
            args.targetAgentIds.map((id) => ctx.db.get(id)),
          );

    for (const agent of agents) {
      if (!agent) continue;
      await ctx.db.insert("notifications", {
        workspaceId: args.workspaceId,
        mentionedAgentId: agent._id,
        taskId: null,
        message: `Broadcast from ${displayName}: "${args.title}"`,
        delivered: false,
        createdAt: now,
      });
    }

    return broadcastId;
  },
});

/** List broadcasts (viewer+). */
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    return await ctx.db
      .query("broadcasts")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(50);
  },
});

/** Get broadcast with responses (viewer+). */
export const getById = query({
  args: { workspaceId: v.id("workspaces"), id: v.id("broadcasts") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const broadcast = await ctx.db.get(args.id);
    if (!broadcast || broadcast.workspaceId !== args.workspaceId) return null;

    const responses = await Promise.all(
      broadcast.responses.map((msgId) => ctx.db.get(msgId)),
    );
    return { ...broadcast, responseMessages: responses.filter(Boolean) };
  },
});

export const addResponse = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    broadcastId: v.id("broadcasts"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast || broadcast.workspaceId !== args.workspaceId)
      throw new Error("Broadcast not found");
    await ctx.db.patch(args.broadcastId, {
      responses: [...broadcast.responses, args.messageId],
    });
  },
});
