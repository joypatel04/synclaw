import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireRole,
  requireMember,
  resolveActorName,
} from "./lib/permissions";
import { maxAgentsForWorkspace } from "./lib/billing";

const defaultTelemetry = {
  currentModel: "unknown",
  openclawVersion: "unknown",
  totalTokensUsed: 0,
  lastRunDurationMs: 0,
  lastRunCost: 0,
};

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
      .withIndex("byWorkspaceAndSessionKey", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("sessionKey", args.sessionKey),
      )
      .first();
    return agent ?? null;
  },
});

/** Update agent status (admin+). */
export const updateStatus = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.id("agents"),
    status: v.union(
      v.literal("idle"),
      v.literal("active"),
      v.literal("error"),
      v.literal("offline"),
    ),
    currentTaskId: v.optional(v.union(v.id("tasks"), v.null())),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "admin");
    const agent = await ctx.db.get(args.id);
    if (!agent || agent.workspaceId !== args.workspaceId)
      throw new Error("Agent not found");

    const updates: Record<string, unknown> = { status: args.status };
    if (args.currentTaskId !== undefined) {
      updates.currentTaskId = args.currentTaskId;
    }
    await ctx.db.patch(args.id, updates);

    // Avoid logging routine active/idle churn as activity noise.
    if (args.status === "error" || args.status === "offline") {
      await ctx.db.insert("activities", {
        workspaceId: args.workspaceId,
        type: "agent_status",
        agentId: args.id,
        taskId: null,
        message: `${agent.emoji} ${agent.name} is now ${args.status}`,
        metadata: { previousStatus: agent.status, newStatus: args.status },
        createdAt: Date.now(),
      });
    }
  },
});

/** Heartbeat update (no auth — called by agent itself). */
export const updateHeartbeat = mutation({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) throw new Error("Agent not found");
    const now = Date.now();
    await ctx.db.patch(args.id, {
      lastHeartbeat: now,
      lastPulseAt: now,
    });
  },
});

/**
 * Lightweight "pulse" from an agent.
 * - No auth (called by agent itself via API key)
 * - Updates lastPulseAt and status
 * - Optionally merges in telemetry from the most recent run.
 */
export const agentPulse = mutation({
  args: {
    id: v.id("agents"),
    status: v.union(
      v.literal("idle"),
      v.literal("active"),
      v.literal("error"),
      v.literal("offline"),
    ),
    telemetry: v.optional(
      v.object({
        currentModel: v.optional(v.string()),
        openclawVersion: v.optional(v.string()),
        totalTokensUsed: v.optional(v.number()),
        lastRunDurationMs: v.optional(v.number()),
        lastRunCost: v.optional(v.float64()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) throw new Error("Agent not found");

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      lastPulseAt: now,
      lastHeartbeat: now,
    };

    // Normalize legacy/partial telemetry. Older rows may be missing fields that are
    // required by the current schema; merging with defaults repairs them.
    const prev = {
      ...defaultTelemetry,
      ...(agent.telemetry ?? {}),
    };
    patch.telemetry = args.telemetry
      ? {
          ...prev,
          ...args.telemetry,
        }
      : prev;

    await ctx.db.patch(args.id, patch);

    if (
      agent.status !== args.status &&
      (args.status === "error" || args.status === "offline")
    ) {
      await ctx.db.insert("activities", {
        workspaceId: agent.workspaceId,
        type: "agent_status",
        agentId: args.id,
        taskId: agent.currentTaskId ?? null,
        message: `${agent.emoji} ${agent.name} is now ${args.status}`,
        metadata: {
          previousStatus: agent.status,
          newStatus: args.status,
          source: "agentPulse",
        },
        createdAt: now,
      });
    }
  },
});

/**
 * Mark that an agent has started actively working on a task.
 * Called by OpenClaw when it picks up work.
 */
export const startTaskSession = mutation({
  args: {
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.workspaceId !== agent.workspaceId) {
      throw new Error("Task and agent belong to different workspaces");
    }

    const now = Date.now();

    await ctx.db.patch(args.agentId, {
      status: "active",
      currentTaskId: args.taskId,
      lastPulseAt: now,
      lastHeartbeat: now,
    });

    await ctx.db.insert("activities", {
      workspaceId: agent.workspaceId,
      type: "agent_status",
      agentId: args.agentId,
      taskId: args.taskId,
      message: `${agent.emoji} ${agent.name} started working on "${task.title}"`,
      metadata: {
        action: "startTaskSession",
      },
      createdAt: now,
    });
  },
});

/**
 * Mark that an agent finished its current task session.
 * - Clears currentTaskId
 * - Updates status (idle / error)
 * - Optionally updates telemetry + run summary.
 */
export const endTaskSession = mutation({
  args: {
    agentId: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("error")),
    telemetry: v.optional(
      v.object({
        currentModel: v.optional(v.string()),
        openclawVersion: v.optional(v.string()),
        totalTokensUsed: v.optional(v.number()),
        lastRunDurationMs: v.optional(v.number()),
        lastRunCost: v.optional(v.float64()),
      }),
    ),
    runSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    const now = Date.now();
    const previous = {
      ...defaultTelemetry,
      ...(agent.telemetry ?? {}),
    };
    const runTokens = args.telemetry?.totalTokensUsed ?? 0;
    const nextTelemetry =
      args.telemetry === undefined
        ? previous
        : {
            currentModel: args.telemetry.currentModel ?? previous.currentModel,
            openclawVersion:
              args.telemetry.openclawVersion ?? previous.openclawVersion,
            totalTokensUsed: previous.totalTokensUsed + Math.max(0, runTokens),
            lastRunDurationMs:
              args.telemetry.lastRunDurationMs ?? previous.lastRunDurationMs,
            lastRunCost: args.telemetry.lastRunCost ?? previous.lastRunCost,
          };

    const patch: Partial<typeof agent> = {
      status: args.status,
      currentTaskId: null,
      lastPulseAt: now,
      lastHeartbeat: now,
      telemetry: nextTelemetry,
    };

    await ctx.db.patch(args.agentId, patch);

    const currentTaskId = agent.currentTaskId ?? null;
    let taskTitle: string | null = null;
    if (currentTaskId) {
      const task = await ctx.db.get(currentTaskId);
      if (task) {
        taskTitle = task.title;
      }
    }

    await ctx.db.insert("activities", {
      workspaceId: agent.workspaceId,
      type: "agent_status",
      agentId: args.agentId,
      taskId: currentTaskId,
      message:
        taskTitle != null
          ? `${agent.emoji} ${agent.name} finished working on "${taskTitle}" with status ${args.status}`
          : `${agent.emoji} ${agent.name} ended session with status ${args.status}`,
      metadata: {
        action: "endTaskSession",
        runSummary: args.runSummary,
        telemetry: args.telemetry ?? null,
      },
      createdAt: now,
    });

    // Log run for cost tracking (if telemetry provided)
    // Note: We log runs even if cost is $0.00 (free models) to track activity
    if (args.telemetry?.lastRunCost !== undefined) {
      await ctx.db.insert("agentRuns", {
        workspaceId: agent.workspaceId,
        agentId: args.agentId,
        taskId: currentTaskId,
        cost: args.telemetry.lastRunCost, // Can be 0.00 for free models
        tokensUsed: runTokens,
        durationMs: args.telemetry.lastRunDurationMs ?? 0,
        createdAt: now,
      });
    }
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
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const existingAgents = await ctx.db
      .query("agents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const activeCount = existingAgents.filter((a) => !a.isArchived).length;
    const maxAgents = maxAgentsForWorkspace(workspace);
    if (activeCount >= maxAgents) {
      throw new Error(
        "Free workspaces can run up to 3 active agents. Upgrade in Settings -> Billing for more.",
      );
    }

    const now = Date.now();
    const id = await ctx.db.insert("agents", {
      workspaceId: args.workspaceId,
      name: args.name,
      role: args.role,
      emoji: args.emoji,
      sessionKey: args.sessionKey,
      externalAgentId: args.externalAgentId,
      isArchived: false,
      status: "idle",
      currentTaskId: null,
      // New agents should start "offline" until they send their first real pulse/heartbeat.
      lastHeartbeat: 0,
      telemetry: defaultTelemetry,
      createdAt: now,
    });

    // Auto-create a "setup" checklist task so onboarding isn't ephemeral.
    // This makes setup work durable and trackable in the dashboard.
    const { displayName, agentId: actingAgentId } = await resolveActorName(
      ctx,
      membership.userId,
      null,
    );

    const agentsInWorkspace = await ctx.db
      .query("agents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const mainAgent =
      agentsInWorkspace.find(
        (a) => a.sessionKey === "agent:main:main" && !a.isArchived,
      ) ?? null;

    const assigneeIds = mainAgent ? [mainAgent._id] : [];
    const status = assigneeIds.length > 0 ? "assigned" : ("inbox" as const);

    const title = `Setup agent: ${args.name} (${args.sessionKey})`;
    const description = `Checklist:
- [ ] Configure Sutraha HQ MCP server (MCPorter config)
- [ ] Set the agent's bootstrap prompt in OpenClaw
- [ ] Add SUTRAHA_PROTOCOL.md + HEARTBEAT.md to the agent's OpenClaw workspace
- [ ] Schedule a cron run (use the cron prompt from Sutraha HQ)
- [ ] Confirm first pulse is received in Sutraha HQ (agent shows Connected)

Links:
- Agent setup: [open](/agents/${id}/setup)
- OpenClaw settings: [open](/settings/openclaw)
- Agent health: [open](/agents/health)

Notes:
- Prefer short, stable local files. Keep long context in Sutraha HQ Documents.
- Never reuse another agent's sessionKey.`;

    const taskId = await ctx.db.insert("tasks", {
      workspaceId: args.workspaceId,
      title,
      description,
      status,
      assigneeIds,
      priority: "medium",
      createdBy: displayName,
      dueAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "task_created",
      agentId: actingAgentId,
      taskId,
      message: `${displayName} created task "${title}"`,
      metadata: { priority: "medium", status, source: "agent_create_setup" },
      createdAt: now,
    });

    return id;
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

/**
 * Calculate daily burn rate (total cost spent today).
 * Aggregates all agent runs from today.
 */
export const getDailyBurnRate = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.gte(q.field("createdAt"), todayStartMs))
      .collect();

    const totalCost = runs.reduce((sum, run) => sum + run.cost, 0);
    const totalTokens = runs.reduce((sum, run) => sum + run.tokensUsed, 0);
    const totalDuration = runs.reduce((sum, run) => sum + run.durationMs, 0);

    // Get unique agents that ran today
    const agentIds = new Set(runs.map((r) => r.agentId));
    const allAgents = await ctx.db
      .query("agents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return {
      totalCost,
      totalTokens,
      totalDurationMs: totalDuration,
      runCount: runs.length,
      activeAgentCount: agentIds.size,
      totalAgentCount: allAgents.filter((a) => !a.isArchived).length,
      currency: "USD",
    };
  },
});

/**
 * Get cost breakdown for a specific task.
 * Sums all runs associated with this task.
 */
export const getTaskCost = query({
  args: {
    workspaceId: v.id("workspaces"),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);

    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("byTask", (q) => q.eq("taskId", args.taskId))
      .collect();

    const totalCost = runs.reduce((sum, run) => sum + run.cost, 0);
    const totalTokens = runs.reduce((sum, run) => sum + run.tokensUsed, 0);
    const totalDuration = runs.reduce((sum, run) => sum + run.durationMs, 0);

    // Group by agent
    const byAgent: Record<string, { cost: number; runs: number }> = {};
    for (const run of runs) {
      const agentId = run.agentId;
      if (!byAgent[agentId]) {
        byAgent[agentId] = { cost: 0, runs: 0 };
      }
      byAgent[agentId].cost += run.cost;
      byAgent[agentId].runs += 1;
    }

    return {
      taskId: args.taskId,
      totalCost,
      totalTokens,
      totalDurationMs: totalDuration,
      runCount: runs.length,
      byAgent,
      currency: "USD",
    };
  },
});
