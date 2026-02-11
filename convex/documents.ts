import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireMember } from "./lib/permissions";

const documentTypeValidator = v.union(
  v.literal("deliverable"),
  v.literal("research"),
  v.literal("protocol"),
  v.literal("note"),
  v.literal("journal"),
);

const documentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("final"),
  v.literal("archived"),
);

export const upsertDocument = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    id: v.optional(v.id("documents")),
    title: v.string(),
    content: v.string(),
    type: documentTypeValidator,
    status: documentStatusValidator,
    taskId: v.union(v.id("tasks"), v.null()),
    folderId: v.optional(v.id("folders")),
    agentId: v.id("agents"),
    isGlobalContext: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");

    const now = Date.now();
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.workspaceId !== args.workspaceId) {
        throw new Error("Document not found");
      }

      await ctx.db.patch(args.id, {
        title: args.title,
        content: args.content,
        type: args.type,
        status: args.status,
        taskId: args.taskId,
        folderId: args.folderId,
        isGlobalContext: args.isGlobalContext ?? existing.isGlobalContext,
        lastEditedBy: args.agentId,
        version: existing.version + 1,
        updatedAt: now,
      });

      return args.id;
    }

    return await ctx.db.insert("documents", {
      workspaceId: args.workspaceId,
      title: args.title,
      content: args.content,
      agentId: args.agentId,
      lastEditedBy: args.agentId,
      type: args.type,
      status: args.status,
      taskId: args.taskId,
      folderId: args.folderId,
      isGlobalContext: args.isGlobalContext ?? false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    type: documentTypeValidator,
    taskId: v.union(v.id("tasks"), v.null()),
    folderId: v.optional(v.id("folders")),
    agentId: v.id("agents"),
    isGlobalContext: v.optional(v.boolean()),
    status: v.optional(documentStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");
    const now = Date.now();
    return await ctx.db.insert("documents", {
      workspaceId: args.workspaceId,
      title: args.title,
      content: args.content,
      agentId: args.agentId,
      lastEditedBy: args.agentId,
      type: args.type,
      status: args.status ?? "draft",
      taskId: args.taskId,
      folderId: args.folderId,
      isGlobalContext: args.isGlobalContext ?? false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.optional(documentTypeValidator),
    status: v.optional(documentStatusValidator),
    folderId: v.optional(v.id("folders")),
    isGlobalContext: v.optional(v.boolean()),
    onlyDrafts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    let docs = await ctx.db
      .query("documents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    if (args.type) docs = docs.filter((d) => d.type === args.type);
    if (args.status) docs = docs.filter((d) => d.status === args.status);
    if (args.folderId) docs = docs.filter((d) => d.folderId === args.folderId);
    if (args.isGlobalContext !== undefined) {
      docs = docs.filter((d) => d.isGlobalContext === args.isGlobalContext);
    }
    if (args.onlyDrafts) docs = docs.filter((d) => d.status === "draft");
    return docs;
  },
});

export const listGlobalContext = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    return await ctx.db
      .query("documents")
      .withIndex("global", (q) => q.eq("isGlobalContext", true))
      .filter((q) => q.eq(q.field("workspaceId"), args.workspaceId))
      .order("desc")
      .collect();
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
