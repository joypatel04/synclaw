import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireMember } from "./lib/permissions";

/** List agents in a workspace (viewer+). */
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const all = await ctx.db
      .query("agents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("asc")
      .collect();
    if (args.includeArchived) return all;
    return all.filter((a) => !a.isArchived);
  },
});

/** Get a single agent (viewer+). */
export const getById = query({
  args: { workspaceId: v.id("workspaces"), id: v.id("agents") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const agent = await ctx.db.get(args.id);
    if (!agent || agent.workspaceId !== args.workspaceId) return null;
    return agent;
  },
});

/** Find agent by session key (viewer+). */
export const getBySessionKey = query({
  args: { workspaceId: v.id("workspaces"), sessionKey: v.string() },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const agent = await ctx.db
      .query("agents")
      .withIndex("bySessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    if (!agent || agent.workspaceId !== args.workspaceId) return null;
    return agent;
  },
});

/** Update agent status (admin+). */
export const updateStatus = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("active"), v.literal("blocked")),
    currentTaskId: v.optional(v.union(v.id("tasks"), v.null())),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "admin");
    const agent = await ctx.db.get(args.id);
    if (!agent || agent.workspaceId !== args.workspaceId)
      throw new Error("Agent not found");

    const updates: Record<string, unknown> = { status: args.status };
    if (args.currentTaskId !== undefined) updates.currentTaskId = args.currentTaskId;
    await ctx.db.patch(args.id, updates);

    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "agent_status",
      agentId: args.id,
      taskId: null,
      message: `${agent.emoji} ${agent.name} is now ${args.status}`,
      metadata: { previousStatus: agent.status, newStatus: args.status },
      createdAt: Date.now(),
    });
  },
});

/** Heartbeat update (no auth — called by agent itself). */
export const updateHeartbeat = mutation({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) throw new Error("Agent not found");
    await ctx.db.patch(args.id, { lastHeartbeat: Date.now() });
  },
});

/** Acknowledge activities up to a given timestamp (member+). */
export const ackActivities = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    upTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const agent = await ctx.db.get(args.agentId);
    if (!agent || agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent not found");
    }
    const timestamp = args.upTo ?? Date.now();
    await ctx.db.patch(args.agentId, { lastSeenActivityAt: timestamp });
  },
});

/** Create a new agent (owner only). */
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    role: v.string(),
    emoji: v.string(),
    sessionKey: v.string(),
    externalAgentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "owner");
    return await ctx.db.insert("agents", {
      workspaceId: args.workspaceId,
      name: args.name,
      role: args.role,
      emoji: args.emoji,
      sessionKey: args.sessionKey,
      externalAgentId: args.externalAgentId,
      isArchived: false,
      status: "idle",
      currentTaskId: null,
      lastHeartbeat: Date.now(),
      createdAt: Date.now(),
    });
  },
});

/** Update an existing agent (owner only). */
export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.id("agents"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    emoji: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    externalAgentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "owner");
    const agent = await ctx.db.get(args.id);
    if (!agent || agent.workspaceId !== args.workspaceId)
      throw new Error("Agent not found");

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.role !== undefined) updates.role = args.role;
    if (args.emoji !== undefined) updates.emoji = args.emoji;
    if (args.sessionKey !== undefined) updates.sessionKey = args.sessionKey;
    if (args.externalAgentId !== undefined)
      updates.externalAgentId = args.externalAgentId;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.id, updates);
    }

    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "agent_status",
      agentId: args.id,
      taskId: null,
      message: `${agent.emoji} ${agent.name} was updated`,
      metadata: { action: "updated", changes: Object.keys(updates) },
      createdAt: Date.now(),
    });
  },
});

/** Archive or unarchive an agent (owner only). */
export const toggleArchive = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "owner");
    const agent = await ctx.db.get(args.id);
    if (!agent || agent.workspaceId !== args.workspaceId)
      throw new Error("Agent not found");

    const newArchived = !agent.isArchived;
    await ctx.db.patch(args.id, { isArchived: newArchived });

    // If archiving, also set status to idle
    if (newArchived) {
      await ctx.db.patch(args.id, { status: "idle" });
    }

    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "agent_status",
      agentId: args.id,
      taskId: null,
      message: `${agent.emoji} ${agent.name} was ${newArchived ? "archived" : "unarchived"}`,
      metadata: { action: newArchived ? "archived" : "unarchived" },
      createdAt: Date.now(),
    });
  },
});
