import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember } from "./lib/permissions";

/**
 * Workspace onboarding status.
 *
 * "Complete" means:
 * - OpenClaw Gateway config exists (wsUrl saved)
 * - Canonical main agent exists (sessionKey: agent:main:main)
 */
export const getStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const membership = await requireMember(ctx, args.workspaceId);
    const isOwner = membership.role === "owner";

    const openclaw = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const openclawConfigured = Boolean(openclaw?.wsUrl);

    // We don't have a compound index for (workspaceId, sessionKey), so we scan
    // the workspace agents. This should remain small in normal usage.
    const agents = await ctx.db
      .query("agents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const mainAgent = agents.find((a) => a.sessionKey === "agent:main:main") ?? null;
    const mainAgentId = mainAgent ? mainAgent._id : null;

    const isComplete = openclawConfigured && mainAgentId !== null;

    return {
      isOwner,
      openclawConfigured,
      mainAgentId,
      isComplete,
    };
  },
});

