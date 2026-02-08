import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireMember } from "./lib/permissions";

/** Send a chat message (member+ for user messages). */
export const send = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sessionId: v.string(),
    fromUser: v.boolean(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.fromUser) {
      await requireRole(ctx, args.workspaceId, "member");
    }
    return await ctx.db.insert("chatMessages", {
      workspaceId: args.workspaceId,
      sessionId: args.sessionId,
      fromUser: args.fromUser,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

/** List chat messages for a session (viewer+). */
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    return await ctx.db
      .query("chatMessages")
      .withIndex("bySession", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(args.limit ?? 100);
  },
});

/** List active chat sessions (viewer+). */
export const getSessions = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(500);

    const sessionMap = new Map<
      string,
      { sessionId: string; lastMessage: string; lastAt: number }
    >();
    for (const msg of messages) {
      if (!sessionMap.has(msg.sessionId)) {
        sessionMap.set(msg.sessionId, {
          sessionId: msg.sessionId,
          lastMessage: msg.content.substring(0, 100),
          lastAt: msg.createdAt,
        });
      }
    }
    return Array.from(sessionMap.values());
  },
});
