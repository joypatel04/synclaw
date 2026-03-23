import { internalMutation } from "./_generated/server";

// ─── TTL constants ────────────────────────────────────────────────
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Max rows to delete per cron run — keeps each mutation under the 1 MB budget.
const BATCH_SIZE = 500;

/**
 * Delete activity records older than 90 days. GDPR Art. 5 (data minimisation).
 * Runs nightly via crons.ts.
 */
export const purgeOldActivities = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - NINETY_DAYS_MS;
    const rows = await ctx.db
      .query("activities")
      .withIndex("recent", (q) => q.lt("createdAt", cutoff))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length };
  },
});

/**
 * Delete webhook payload records older than 90 days.
 * Runs nightly via crons.ts.
 */
export const purgeOldWebhookPayloads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - NINETY_DAYS_MS;
    const rows = await ctx.db
      .query("webhookPayloads")
      .withIndex("byReceivedAt", (q) => q.lt("receivedAt", cutoff))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length };
  },
});

/**
 * Expire workspace invites older than 30 days that are still pending.
 * Runs nightly via crons.ts.
 */
export const expireOldInvites = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const rows = await ctx.db
      .query("workspaceInvites")
      .withIndex("byCreatedAt", (q) => q.lt("createdAt", cutoff))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(BATCH_SIZE);

    for (const row of rows) {
      await ctx.db.patch(row._id, { status: "expired" });
    }

    return { expired: rows.length };
  },
});
