import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireMember } from "./lib/permissions";

export const listBySessionKey = query({
  args: {
    workspaceId: v.id("workspaces"),
    sessionKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);

    const rows = await ctx.db
      .query("chatEvents")
      .withIndex("bySessionRecent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("sessionKey", args.sessionKey),
      )
      .order("desc")
      .take(args.limit ?? 200);

    return rows;
  },
});

