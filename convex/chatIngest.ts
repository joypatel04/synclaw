import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRole } from "./lib/permissions";

const chatRole = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system"),
  v.literal("tool"),
);

const chatState = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("streaming"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("aborted"),
);

/**
 * Ingest idempotent gateway events into Convex projection tables.
 * This function is meant for bridge workers using workspace API keys.
 */
export const upsertGatewayEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    sessionKey: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    eventAt: v.optional(v.number()),
    payload: v.any(),
    message: v.optional(
      v.object({
        externalMessageId: v.string(),
        externalRunId: v.optional(v.string()),
        role: chatRole,
        fromUser: v.boolean(),
        content: v.optional(v.string()),
        append: v.optional(v.boolean()),
        state: v.optional(chatState),
        errorCode: v.optional(v.string()),
        errorMessage: v.optional(v.string()),
        sequence: v.optional(v.number()),
      }),
    ),
    openclawSessionId: v.optional(v.string()),
    sessionStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("idle"),
        v.literal("error"),
        v.literal("closed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");

    const now = Date.now();
    const eventTime = args.eventAt ?? now;

    const duplicate = await ctx.db
      .query("chatEvents")
      .withIndex("bySessionAndEvent", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("sessionKey", args.sessionKey)
          .eq("eventId", args.eventId),
      )
      .first();

    if (duplicate) {
      return { deduped: true, eventId: args.eventId };
    }

    await ctx.db.insert("chatEvents", {
      workspaceId: args.workspaceId,
      sessionKey: args.sessionKey,
      eventId: args.eventId,
      eventType: args.eventType,
      payload: args.payload,
      receivedAt: eventTime,
    });

    const agent = await ctx.db
      .query("agents")
      .withIndex("bySessionKey", (q) => q.eq("sessionKey", args.sessionKey))
      .first();

    if (!agent || agent.workspaceId !== args.workspaceId) {
      throw new Error("Agent/session not found for workspace");
    }

    const existingSession = await ctx.db
      .query("chatSessions")
      .withIndex("bySessionKey", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("sessionKey", args.sessionKey),
      )
      .first();

    if (existingSession) {
      await ctx.db.patch(existingSession._id, {
        openclawSessionId:
          args.openclawSessionId ?? existingSession.openclawSessionId,
        lastEventAt: eventTime,
        status: args.sessionStatus ?? existingSession.status,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("chatSessions", {
        workspaceId: args.workspaceId,
        agentId: agent._id,
        sessionKey: args.sessionKey,
        openclawSessionId: args.openclawSessionId,
        lastEventAt: eventTime,
        status: args.sessionStatus ?? "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!args.message) {
      return { deduped: false, eventId: args.eventId, updatedMessage: null };
    }

    const sessionId = `chat:${args.sessionKey}`;

    const existingMessage = await ctx.db
      .query("chatMessages")
      .withIndex("byExternalMessageId", (q) =>
        q.eq("externalMessageId", args.message.externalMessageId),
      )
      .first();

    if (existingMessage && existingMessage.workspaceId !== args.workspaceId) {
      throw new Error("Cross-workspace message id collision");
    }

    const fallbackLast = await ctx.db
      .query("chatMessages")
      .withIndex("bySession", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(1);
    const fallbackSequence = (fallbackLast[0]?.sequence ?? 0) + 1;

    const state = args.message.state ?? "streaming";

    if (existingMessage) {
      const nextContent = args.message.append
        ? `${existingMessage.content}${args.message.content ?? ""}`
        : (args.message.content ?? existingMessage.content);

      await ctx.db.patch(existingMessage._id, {
        content: nextContent,
        role: args.message.role,
        fromUser: args.message.fromUser,
        state,
        externalRunId:
          args.message.externalRunId ?? existingMessage.externalRunId,
        errorCode: args.message.errorCode,
        errorMessage: args.message.errorMessage,
        sequence: args.message.sequence ?? existingMessage.sequence,
        updatedAt: now,
      });

      return {
        deduped: false,
        eventId: args.eventId,
        updatedMessage: existingMessage._id,
      };
    }

    const inserted = await ctx.db.insert("chatMessages", {
      workspaceId: args.workspaceId,
      sessionId,
      fromUser: args.message.fromUser,
      content: args.message.content ?? "",
      role: args.message.role,
      state,
      externalMessageId: args.message.externalMessageId,
      externalRunId: args.message.externalRunId,
      errorCode: args.message.errorCode,
      errorMessage: args.message.errorMessage,
      sequence: args.message.sequence ?? fallbackSequence,
      createdAt: eventTime,
      updatedAt: now,
    });

    return { deduped: false, eventId: args.eventId, updatedMessage: inserted };
  },
});
