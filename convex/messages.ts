import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireMember, getUserDisplayName } from "./lib/permissions";

/** Post a comment (member+). */
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    taskId: v.union(v.id("tasks"), v.null()),
    agentId: v.union(v.id("agents"), v.null()),
    content: v.string(),
    attachments: v.optional(v.array(v.id("documents"))),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "member");
    const authorName = await getUserDisplayName(ctx, membership.userId);
    const now = Date.now();

    const messageId = await ctx.db.insert("messages", {
      workspaceId: args.workspaceId,
      taskId: args.taskId,
      agentId: args.agentId,
      authorName,
      content: args.content,
      attachments: args.attachments ?? [],
      createdAt: now,
    });

    // Log activity
    const taskRef = args.taskId ? await ctx.db.get(args.taskId) : null;
    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "message_sent",
      agentId: args.agentId,
      taskId: args.taskId,
      message: taskRef
        ? `${authorName} commented on "${taskRef.title}"`
        : `${authorName} posted a message`,
      metadata: {},
      createdAt: now,
    });

    // @mention detection → create notifications
    const mentionRegex = /@(\w+)/g;
    let match: RegExpExecArray | null;
    const agents = await ctx.db
      .query("agents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    while (true) {
      match = mentionRegex.exec(args.content);
      if (!match) break;
      const mentioned = agents.find(
        (a) => a.name.toLowerCase() === match![1].toLowerCase(),
      );
      if (mentioned) {
        await ctx.db.insert("notifications", {
          workspaceId: args.workspaceId,
          mentionedAgentId: mentioned._id,
          taskId: args.taskId,
          message: `${authorName} mentioned you: "${args.content.substring(0, 100)}"`,
          delivered: false,
          createdAt: now,
        });
      }
    }

    return messageId;
  },
});

/** List messages for a task (viewer+). */
export const list = query({
  args: { workspaceId: v.id("workspaces"), taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    return await ctx.db
      .query("messages")
      .withIndex("byTask", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();
  },
});

/** Get full thread for a task (viewer+). */
export const thread = query({
  args: { workspaceId: v.id("workspaces"), taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const task = await ctx.db.get(args.taskId);
    const messages = await ctx.db
      .query("messages")
      .withIndex("byTask", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();
    return { task, messages };
  },
});
