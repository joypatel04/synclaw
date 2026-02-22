import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireMember,
  requireRole,
  resolveActorName,
} from "./lib/permissions";

const taskStatus = v.union(
  v.literal("inbox"),
  v.literal("assigned"),
  v.literal("in_progress"),
  v.literal("review"),
  v.literal("done"),
  v.literal("blocked"),
);

const taskPriority = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
  v.literal("none"),
);

/** Create a task (member+). */
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.string(),
    status: v.optional(taskStatus),
    assigneeIds: v.array(v.id("agents")),
    priority: taskPriority,
    dueAt: v.union(v.number(), v.null()),

    actingAgentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "member");
    const { displayName, agentId } = await resolveActorName(
      ctx,
      membership.userId,
      args.actingAgentId,
    );
    const now = Date.now();
    const status =
      args.assigneeIds.length > 0 &&
      (args.status === undefined || args.status === "inbox")
        ? "assigned"
        : (args.status ?? "inbox");

    const taskId = await ctx.db.insert("tasks", {
      workspaceId: args.workspaceId,
      title: args.title,
      description: args.description,
      status,
      assigneeIds: args.assigneeIds,
      priority: args.priority,
      createdBy: displayName,
      dueAt: args.dueAt,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "task_created",
      agentId,
      taskId,
      message: `${displayName} created task "${args.title}"`,
      metadata: { priority: args.priority, status },
      createdAt: now,
    });

    return taskId;
  },
});

/** Update task fields (member+). */
export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(taskStatus),
    assigneeIds: v.optional(v.array(v.id("agents"))),
    priority: v.optional(taskPriority),
    dueAt: v.optional(v.union(v.number(), v.null())),
    actingAgentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "member");
    const { displayName, agentId } = await resolveActorName(
      ctx,
      membership.userId,
      args.actingAgentId,
    );
    const { id, workspaceId, actingAgentId: _, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing || existing.workspaceId !== workspaceId)
      throw new Error("Task not found");

    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });

    await ctx.db.insert("activities", {
      workspaceId,
      type: "task_updated",
      agentId,
      taskId: id,
      message: `${displayName} updated task "${existing.title}"`,
      metadata: { fields: Object.keys(fields) },
      createdAt: Date.now(),
    });
  },
});

/** Change task status only (member+). */
export const updateStatus = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.id("tasks"),
    status: taskStatus,
    blockedReason: v.optional(v.string()),
    actingAgentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "member");
    const { displayName, agentId } = await resolveActorName(
      ctx,
      membership.userId,
      args.actingAgentId,
    );
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.workspaceId !== args.workspaceId)
      throw new Error("Task not found");

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };
    const trimmedReason = args.blockedReason?.trim();

    if (args.status === "blocked") {
      patch.blockedAt = now;
      if (trimmedReason && trimmedReason.length > 0) {
        patch.blockedReason = trimmedReason;
      }
    } else if (existing.status === "blocked") {
      patch.blockedAt = undefined;
      patch.blockedReason = undefined;
    }

    await ctx.db.patch(args.id, patch);

    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "task_updated",
      agentId,
      taskId: args.id,
      message: `${displayName} moved "${existing.title}" to ${args.status.replace("_", " ")}`,
      metadata: {
        from: existing.status,
        to: args.status,
        blockedReason: args.status === "blocked" ? (trimmedReason ?? null) : null,
      },
      createdAt: now,
    });
  },
});

/** List tasks in a workspace (viewer+). */
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(taskStatus),
    statuses: v.optional(v.array(taskStatus)),
    assigneeId: v.optional(v.id("agents")),
    limit: v.optional(v.number()),
    since: v.optional(v.number()),
    includeDone: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const all = await ctx.db
      .query("tasks")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    const limit = args.limit ?? 0;
    const includeDone = args.includeDone ?? true;
    const statusSet =
      args.statuses && args.statuses.length > 0
        ? new Set(args.statuses)
        : null;

    return all
      .filter((t) => {
        if (!includeDone && t.status === "done") return false;
        if (args.status && t.status !== args.status) return false;
        if (statusSet && !statusSet.has(t.status)) return false;
        if (args.assigneeId && !t.assigneeIds.includes(args.assigneeId))
          return false;
        if (args.since !== undefined && t.updatedAt < args.since) return false;
        return true;
      })
      .slice(0, limit > 0 ? limit : undefined);
  },
});

/** Get tasks assigned to a specific agent (viewer+). */
export const getByAssignee = query({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    status: v.optional(taskStatus),
    statuses: v.optional(v.array(taskStatus)),
    limit: v.optional(v.number()),
    since: v.optional(v.number()),
    includeDone: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const all = await ctx.db
      .query("tasks")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    const limit = args.limit ?? 0;
    const includeDone = args.includeDone ?? true;
    const statusSet =
      args.statuses && args.statuses.length > 0
        ? new Set(args.statuses)
        : null;

    return all
      .filter((t) => {
        if (!t.assigneeIds.includes(args.agentId)) return false;
        if (!includeDone && t.status === "done") return false;
        if (args.status && t.status !== args.status) return false;
        if (statusSet && !statusSet.has(t.status)) return false;
        if (args.since !== undefined && t.updatedAt < args.since) return false;
        return true;
      })
      .slice(0, limit > 0 ? limit : undefined);
  },
});

/** Get a single task (viewer+). */
export const getById = query({
  args: { workspaceId: v.id("workspaces"), id: v.id("tasks") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const task = await ctx.db.get(args.id);
    if (!task || task.workspaceId !== args.workspaceId) return null;
    return task;
  },
});

/** Delete a task (admin+). */
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), id: v.id("tasks") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "admin");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.workspaceId !== args.workspaceId)
      throw new Error("Task not found");

    await ctx.db.delete(args.id);
    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "task_updated",
      agentId: null,
      taskId: args.id,
      message: `Task "${existing.title}" was deleted`,
      metadata: { action: "deleted" },
      createdAt: Date.now(),
    });
  },
});
