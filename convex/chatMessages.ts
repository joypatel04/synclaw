import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireMember, requireRole } from "./lib/permissions";

function makeClientMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseSessionKey(sessionId: string) {
  return sessionId.startsWith("chat:") ? sessionId.slice(5) : sessionId;
}

async function resolveAgentIdBySessionKey(
  ctx: Parameters<typeof requireMember>[0],
  workspaceId: Id<"workspaces">,
  sessionKey: string,
) {
  const agent = await ctx.db
    .query("agents")
    .withIndex("bySessionKey", (q) => q.eq("sessionKey", sessionKey))
    .first();

  if (!agent || agent.workspaceId !== workspaceId) {
    throw new Error("Agent/session not found for workspace");
  }

  return agent._id;
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

/** Enqueue a user message and corresponding outbox command for bridge delivery. */
export const sendFromUser = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sessionId: v.string(),
    sessionKey: v.optional(v.string()),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");

    const now = Date.now();
    const clientMessageId = makeClientMessageId();
    const sessionKey = args.sessionKey ?? parseSessionKey(args.sessionId);
    const sequence = await nextSequence(ctx, args.sessionId);

    await ctx.db.insert("chatMessages", {
      workspaceId: args.workspaceId,
      sessionId: args.sessionId,
      fromUser: true,
      content: args.content,
      role: "user",
      state: "queued",
      externalMessageId: clientMessageId,
      sequence,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("chatOutbox", {
      workspaceId: args.workspaceId,
      sessionKey,
      clientMessageId,
      commandType: "chat.send",
      payload: {
        content: args.content,
        sessionId: args.sessionId,
      },
      attempt: 0,
      nextAttemptAt: now,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });

    const agentId = await resolveAgentIdBySessionKey(
      ctx,
      args.workspaceId,
      sessionKey,
    );

    const existingSession = await ctx.db
      .query("chatSessions")
      .withIndex("bySessionKey", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("sessionKey", sessionKey),
      )
      .first();

    if (existingSession) {
      await ctx.db.patch(existingSession._id, {
        lastEventAt: now,
        status: "active",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("chatSessions", {
        workspaceId: args.workspaceId,
        agentId,
        sessionKey,
        status: "active",
        lastEventAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { clientMessageId };
  },
});

/** Queue an abort command for an in-flight run. */
export const abortRun = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sessionId: v.string(),
    externalRunId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");

    const now = Date.now();
    const clientMessageId = makeClientMessageId();
    const sessionKey = parseSessionKey(args.sessionId);

    await ctx.db.insert("chatOutbox", {
      workspaceId: args.workspaceId,
      sessionKey,
      clientMessageId,
      commandType: "chat.abort",
      payload: {
        externalRunId: args.externalRunId,
        sessionId: args.sessionId,
      },
      attempt: 0,
      nextAttemptAt: now,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });

    const openMessage = await ctx.db
      .query("chatMessages")
      .withIndex("byRunId", (q) => q.eq("externalRunId", args.externalRunId))
      .order("desc")
      .take(1);

    if (openMessage[0] && openMessage[0].workspaceId === args.workspaceId) {
      await ctx.db.patch(openMessage[0]._id, {
        state: "aborted",
        updatedAt: now,
      });
    }

    return { clientMessageId };
  },
});

/** Retry a previously failed outbound user message by re-queuing its outbox command. */
export const retryFailedMessage = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    externalMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");

    const outbox = await ctx.db
      .query("chatOutbox")
      .withIndex("byClientMessageId", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("clientMessageId", args.externalMessageId),
      )
      .first();

    if (!outbox) {
      throw new Error("Outbox record not found for message");
    }

    const now = Date.now();
    await ctx.db.patch(outbox._id, {
      status: "queued",
      nextAttemptAt: now,
      lastError: "manual retry",
      updatedAt: now,
    });

    const message = await ctx.db
      .query("chatMessages")
      .withIndex("byExternalMessageId", (q) =>
        q.eq("externalMessageId", args.externalMessageId),
      )
      .first();

    if (message && message.workspaceId === args.workspaceId) {
      await ctx.db.patch(message._id, {
        state: "queued",
        errorCode: undefined,
        errorMessage: undefined,
        updatedAt: now,
      });
    }

    return { ok: true };
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

    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(200);

    if (sessions.length > 0) {
      const withLastMessage = await Promise.all(
        sessions.map(async (session) => {
          const sessionId = `chat:${session.sessionKey}`;
          const last = await ctx.db
            .query("chatMessages")
            .withIndex("bySession", (q) => q.eq("sessionId", sessionId))
            .order("desc")
            .take(1);

          return {
            sessionId,
            sessionKey: session.sessionKey,
            status: session.status,
            lastMessage: last[0]?.content ?? "",
            lastAt: last[0]?.createdAt ?? session.updatedAt,
          };
        }),
      );

      return withLastMessage;
    }

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
