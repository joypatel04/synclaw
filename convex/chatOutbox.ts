import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/permissions";

function computeBackoffMs(attempt: number) {
  const base = 1000;
  const capped = Math.min(60_000, base * 2 ** Math.max(0, attempt));
  const jitter = Math.floor(Math.random() * 500);
  return capped + jitter;
}

/** Claim a batch of queued outbox commands for bridge workers. */
export const claimBatch = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    workerId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");

    const now = Date.now();
    const batchSize = Math.max(1, Math.min(args.limit ?? 20, 100));

    const queued = await ctx.db
      .query("chatOutbox")
      .withIndex("byStatusNextAttempt", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("status", "queued")
          .lte("nextAttemptAt", now),
      )
      .take(batchSize);

    for (const row of queued) {
      await ctx.db.patch(row._id, {
        status: "claimed",
        claimedBy: args.workerId,
        claimedAt: now,
        updatedAt: now,
      });
    }

    return queued;
  },
});

/** Mark an outbox command as delivered to gateway. */
export const markSent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    outboxId: v.id("chatOutbox"),
    clientMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");

    const outbox = await ctx.db.get(args.outboxId);
    if (!outbox || outbox.workspaceId !== args.workspaceId) {
      throw new Error("Outbox item not found");
    }
    if (outbox.clientMessageId !== args.clientMessageId) {
      throw new Error("Outbox/clientMessageId mismatch");
    }

    const now = Date.now();
    await ctx.db.patch(args.outboxId, {
      status: "sent",
      updatedAt: now,
    });

    const msg = await ctx.db
      .query("chatMessages")
      .withIndex("byExternalMessageId", (q) =>
        q.eq("externalMessageId", args.clientMessageId),
      )
      .first();

    if (msg && msg.workspaceId === args.workspaceId) {
      await ctx.db.patch(msg._id, {
        state: "sending",
        updatedAt: now,
      });
    }

    return { ok: true };
  },
});

/** Mark an outbox item as failed and optionally reschedule it. */
export const markFailed = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    outboxId: v.id("chatOutbox"),
    error: v.string(),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");

    const outbox = await ctx.db.get(args.outboxId);
    if (!outbox || outbox.workspaceId !== args.workspaceId) {
      throw new Error("Outbox item not found");
    }

    const maxAttempts = Math.max(1, Math.min(args.maxAttempts ?? 6, 20));
    const nextAttempt = outbox.attempt + 1;
    const now = Date.now();

    if (nextAttempt >= maxAttempts) {
      await ctx.db.patch(args.outboxId, {
        status: "failed",
        attempt: nextAttempt,
        lastError: args.error,
        updatedAt: now,
      });

      const msg = await ctx.db
        .query("chatMessages")
        .withIndex("byExternalMessageId", (q) =>
          q.eq("externalMessageId", outbox.clientMessageId),
        )
        .first();

      if (msg && msg.workspaceId === args.workspaceId) {
        await ctx.db.patch(msg._id, {
          state: "failed",
          errorMessage: args.error,
          updatedAt: now,
        });
      }

      return { ok: true, terminal: true };
    }

    const retryAt = now + computeBackoffMs(nextAttempt);
    await ctx.db.patch(args.outboxId, {
      status: "queued",
      attempt: nextAttempt,
      nextAttemptAt: retryAt,
      lastError: args.error,
      updatedAt: now,
    });

    return { ok: true, terminal: false, retryAt };
  },
});

/** Explicitly reschedule a claimed/failed item. */
export const reschedule = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    outboxId: v.id("chatOutbox"),
    delayMs: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");

    const outbox = await ctx.db.get(args.outboxId);
    if (!outbox || outbox.workspaceId !== args.workspaceId) {
      throw new Error("Outbox item not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.outboxId, {
      status: "queued",
      nextAttemptAt: now + Math.max(0, args.delayMs),
      lastError: args.reason,
      updatedAt: now,
    });

    return { ok: true };
  },
});

/** Find outbox command by client message id. */
export const getByClientMessageId = query({
  args: {
    workspaceId: v.id("workspaces"),
    clientMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "member");
    return await ctx.db
      .query("chatOutbox")
      .withIndex("byClientMessageId", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("clientMessageId", args.clientMessageId),
      )
      .first();
  },
});
