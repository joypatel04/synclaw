import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireMember, getUserDisplayName } from "./lib/permissions";

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
    status: taskStatus,
    assigneeIds: v.array(v.id("agents")),
    priority: taskPriority,
    dueAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "member");
    const displayName = await getUserDisplayName(ctx, membership.userId);
    const now = Date.now();

    const taskId = await ctx.db.insert("tasks", {
      workspaceId: args.workspaceId,
      title: args.title,
      description: args.description,
      status: args.status,
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
      agentId: null,
      taskId,
      message: `${displayName} created task "${args.title}"`,
      metadata: { priority: args.priority, status: args.status },
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
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");
    const { id, workspaceId, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing || existing.workspaceId !== workspaceId)
      throw new Error("Task not found");

    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });

    await ctx.db.insert("activities", {
      workspaceId,
      type: "task_updated",
      agentId: null,
      taskId: id,
      message: `Task "${existing.title}" was updated`,
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
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.workspaceId !== args.workspaceId)
      throw new Error("Task not found");

    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });

    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "task_updated",
      agentId: null,
      taskId: args.id,
      message: `Task "${existing.title}" moved to ${args.status.replace("_", " ")}`,
      metadata: { from: existing.status, to: args.status },
      createdAt: Date.now(),
    });
  },
});

/** List tasks in a workspace (viewer+). */
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(taskStatus),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const all = await ctx.db
      .query("tasks")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    return args.status ? all.filter((t) => t.status === args.status) : all;
  },
});

/** Get tasks assigned to a specific agent (viewer+). */
export const getByAssignee = query({
  args: { workspaceId: v.id("workspaces"), agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const all = await ctx.db
      .query("tasks")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    return all.filter((t) => t.assigneeIds.includes(args.agentId));
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
