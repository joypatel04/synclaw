/**
 * Internal mutations used by the token exchange HTTP action.
 * These are NOT callable from clients — only from other Convex functions.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Create or refresh an auth session for a bot user. */
export const createSession = internalMutation({
  args: {
    userId: v.id("users"),
    expirationTime: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for an existing active session for this bot user
    const existing = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existing && existing.expirationTime > Date.now()) {
      // Refresh the existing session
      await ctx.db.patch(existing._id, {
        expirationTime: args.expirationTime,
      });
      return existing._id;
    }

    // Create a new session
    return await ctx.db.insert("authSessions", {
      userId: args.userId,
      expirationTime: args.expirationTime,
    });
  },
});
