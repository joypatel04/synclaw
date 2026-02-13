import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireMember, requireRole } from "./lib/permissions";

function parseSessionKey(sessionId: string) {
  return sessionId.startsWith("chat:") ? sessionId.slice(5) : sessionId;
}

async function nextSequence(
  ctx: Parameters<typeof requireMember>[0],
  sessionId: string,
) {
  const latest = await ctx.db
    .query("chatMessages")
    .withIndex("bySession", (q) => q.eq("sessionId", sessionId))
    .order("desc")
    .take(1);

  if (latest.length === 0) return 1;
  return (latest[0].sequence ?? 0) + 1;
}

/**
 * Backwards-compatible low-level send.
 * Prefer sendFromUser for user chat and chatIngest.upsertGatewayEvent for bridge writes.
 */
export const send = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sessionId: v.string(),
    fromUser: v.boolean(),
    content: v.string(),
    role: v.optional(
      v.union(
        v.literal("user"),
        v.literal("assistant"),
        v.literal("system"),
        v.literal("tool"),
      ),
    ),
    state: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("sending"),
        v.literal("streaming"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("aborted"),
      ),
    ),
    externalMessageId: v.optional(v.string()),
    externalRunId: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    sequence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.fromUser) {
      await requireRole(ctx, args.workspaceId, "member");
    } else {
      await requireMember(ctx, args.workspaceId);
    }

    const now = Date.now();
    const sequence = args.sequence ?? (await nextSequence(ctx, args.sessionId));

    return await ctx.db.insert("chatMessages", {
      workspaceId: args.workspaceId,
      sessionId: args.sessionId,
      fromUser: args.fromUser,
      content: args.content,
      role: args.role ?? (args.fromUser ? "user" : "assistant"),
      state: args.state ?? "completed",
      externalMessageId: args.externalMessageId,
      externalRunId: args.externalRunId,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      sequence,
      createdAt: now,
      updatedAt: now,
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

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("bySession", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(args.limit ?? 100);

    return messages;
  },
});

/** List chat messages with sequence-aware ordering. */
export const listBySession = query({
  args: {
    workspaceId: v.id("workspaces"),
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("bySession", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(args.limit ?? 200);

    return messages
      .slice()
      .sort((a, b) => {
        const sa = a.sequence ?? Number.MAX_SAFE_INTEGER;
        const sb = b.sequence ?? Number.MAX_SAFE_INTEGER;
        if (sa !== sb) return sa - sb;
        return a.createdAt - b.createdAt;
      })
      .slice(-1 * (args.limit ?? 200));
  },
});

/** List active chat sessions (viewer+). */
export const getSessions = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);

    // Backward-compatible fallback if sessions have not been created yet.
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(500);

    const sessionMap = new Map<
      string,
      {
        sessionId: string;
        sessionKey: string;
        lastMessage: string;
        lastAt: number;
        status: "idle";
      }
    >();

    for (const msg of messages) {
      if (!sessionMap.has(msg.sessionId)) {
        sessionMap.set(msg.sessionId, {
          sessionId: msg.sessionId,
          sessionKey: parseSessionKey(msg.sessionId),
          lastMessage: msg.content.substring(0, 100),
          lastAt: msg.createdAt,
          status: "idle",
        });
      }
    }

    return Array.from(sessionMap.values());
  },
});

/** Backfill role/state/sequence for legacy chat messages. Admin+ only. */
export const backfillLegacyMessages = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "admin");

    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("asc")
      .take(args.limit ?? 5000);

    const seqBySession = new Map<string, number>();
    const now = Date.now();
    let updated = 0;

    for (const msg of rows) {
      const next = (seqBySession.get(msg.sessionId) ?? 0) + 1;
      seqBySession.set(msg.sessionId, next);

      const patch: Record<string, unknown> = {};
      if (!msg.role) patch.role = msg.fromUser ? "user" : "assistant";
      if (!msg.state) patch.state = "completed";
      if (msg.sequence === undefined) patch.sequence = next;
      if (msg.updatedAt === undefined) patch.updatedAt = now;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(msg._id, patch);
        updated += 1;
      }
    }

    return { scanned: rows.length, updated };
  },
});
