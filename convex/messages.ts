import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireMember, resolveActorName } from "./lib/permissions";

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
    const { displayName: authorName, agentId } = await resolveActorName(
      ctx,
      membership.userId,
      args.agentId,
    );
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

    // @mention detection → create notifications for agents
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

    // @mention detection → mention_alert for human workspace members
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    // Build display name and alternate handles (first word, no spaces) so @Joy and @JoyPatel both match "Joy Patel"
    const memberHandles: { displayName: string; handles: string[] }[] = [];
    for (const m of members) {
      const user = await ctx.db.get(m.userId);
      const name = (user as { name?: string | null } | null)?.name ?? (user as { email?: string | null } | null)?.email;
      if (name && typeof name === "string") {
        const displayName = name.trim();
        const firstWord = displayName.split(/\s+/)[0] ?? displayName;
        const noSpaces = displayName.replace(/\s+/g, "");
        const handles = [displayName.toLowerCase(), firstWord.toLowerCase(), noSpaces.toLowerCase()];
        memberHandles.push({ displayName, handles: [...new Set(handles)] });
      }
    }
    const userMentionRegex = /@(\w+)/g;
    let userMatch: RegExpExecArray | null;
    const mentionedUserNames = new Set<string>();
    while (true) {
      userMatch = userMentionRegex.exec(args.content);
      if (!userMatch) break;
      const token = userMatch[1].toLowerCase();
      const entry = memberHandles.find((e) => e.handles.includes(token));
      if (entry && !mentionedUserNames.has(entry.displayName)) {
        mentionedUserNames.add(entry.displayName);
        const snippet = args.content.length > 80 ? `${args.content.substring(0, 80)}…` : args.content;
        await ctx.db.insert("activities", {
          workspaceId: args.workspaceId,
          type: "mention_alert",
          agentId: args.agentId,
          taskId: args.taskId,
          message: `${authorName} mentioned @${entry.displayName}: "${snippet}"`,
          metadata: { taskId: args.taskId },
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
