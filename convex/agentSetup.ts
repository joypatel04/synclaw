import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireMember, requireRole } from "./lib/permissions";

const stepLiteral = v.union(
  v.literal("bootstrapPrimed"),
  v.literal("heartbeatConfirmed"),
  v.literal("cronConfirmed"),
  v.literal("protocolConfirmed"),
  v.literal("localFilesWritten"),
);

type StepName =
  | "bootstrapPrimed"
  | "heartbeatConfirmed"
  | "cronConfirmed"
  | "protocolConfirmed"
  | "localFilesWritten";

type SetupRow = {
  bootstrapPrimedAt?: number;
  heartbeatConfirmedAt?: number;
  cronConfirmedAt?: number;
  protocolConfirmedAt?: number;
  localFilesWrittenAt?: number;
};

function deriveSetupStatus(row: SetupRow | null, hasPulse: boolean) {
  const bootstrapPrimed = Boolean(row?.bootstrapPrimedAt);
  const heartbeatConfirmed = Boolean(row?.heartbeatConfirmedAt);
  const cronConfirmed = Boolean(row?.cronConfirmedAt);
  const protocolConfirmed = Boolean(row?.protocolConfirmedAt);
  const localFilesWritten = Boolean(row?.localFilesWrittenAt);
  const pulseDetected = hasPulse;

  const isComplete =
    bootstrapPrimed && heartbeatConfirmed && cronConfirmed && pulseDetected;

  return {
    bootstrapPrimed,
    heartbeatConfirmed,
    cronConfirmed,
    protocolConfirmed,
    localFilesWritten,
    pulseDetected,
    isComplete,
    timestamps: {
      bootstrapPrimedAt: row?.bootstrapPrimedAt ?? null,
      heartbeatConfirmedAt: row?.heartbeatConfirmedAt ?? null,
      cronConfirmedAt: row?.cronConfirmedAt ?? null,
      protocolConfirmedAt: row?.protocolConfirmedAt ?? null,
      localFilesWrittenAt: row?.localFilesWrittenAt ?? null,
    },
  };
}

function stepToField(step: StepName): keyof SetupRow {
  switch (step) {
    case "bootstrapPrimed":
      return "bootstrapPrimedAt";
    case "heartbeatConfirmed":
      return "heartbeatConfirmedAt";
    case "cronConfirmed":
      return "cronConfirmedAt";
    case "protocolConfirmed":
      return "protocolConfirmedAt";
    case "localFilesWritten":
      return "localFilesWrittenAt";
  }
}

async function getAgent(
  ctx: any,
  workspaceId: Id<"workspaces">,
  agentId: Id<"agents">,
) {
  const agent = await ctx.db.get(agentId);
  if (!agent || agent.workspaceId !== workspaceId) {
    throw new Error("Agent not found");
  }
  return agent;
}

export const getStatus = query({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const agent = await getAgent(ctx, args.workspaceId, args.agentId);

    const row = await ctx.db
      .query("agentSetupProgress")
      .withIndex("byWorkspaceAndAgent", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("agentId", args.agentId),
      )
      .first();

    return {
      agentId: args.agentId,
      ...deriveSetupStatus(row, Boolean(agent.lastPulseAt && agent.lastPulseAt > 0)),
    };
  },
});

export const markStep = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    step: stepLiteral,
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const agent = await getAgent(ctx, args.workspaceId, args.agentId);

    const row = await ctx.db
      .query("agentSetupProgress")
      .withIndex("byWorkspaceAndAgent", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("agentId", args.agentId),
      )
      .first();

    const now = Date.now();
    const field = stepToField(args.step as StepName);

    if (!row) {
      const base: any = {
        workspaceId: args.workspaceId,
        agentId: args.agentId,
        updatedBy: membership.userId,
        updatedAt: now,
      };
      base[field] = now;
      await ctx.db.insert("agentSetupProgress", base);
      return {
        agentId: args.agentId,
        ...deriveSetupStatus(base, Boolean(agent.lastPulseAt && agent.lastPulseAt > 0)),
      };
    }

    const patch: any = {
      updatedBy: membership.userId,
      updatedAt: now,
    };
    patch[field] = now;

    await ctx.db.patch(row._id, patch);
    const next = { ...row, ...patch };

    return {
      agentId: args.agentId,
      ...deriveSetupStatus(next, Boolean(agent.lastPulseAt && agent.lastPulseAt > 0)),
    };
  },
});

export const getWorkspaceSetupOverview = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);

    const onboarding = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const agents = await ctx.db
      .query("agents")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const mainAgent = agents.find((a) => a.sessionKey === "agent:main:main") ?? null;

    const setupRows = await ctx.db
      .query("agentSetupProgress")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const setupMap = new Map(setupRows.map((r) => [String(r.agentId), r]));

    const incompleteAgents = agents
      .filter((a) => !a.isArchived)
      .map((a) => {
        const row = setupMap.get(String(a._id)) ?? null;
        const status = deriveSetupStatus(
          row,
          Boolean(a.lastPulseAt && a.lastPulseAt > 0),
        );
        return { id: a._id, name: a.name, sessionKey: a.sessionKey, ...status };
      })
      .filter((s) => !s.isComplete);

    let firstBlockingReason: string | null = null;
    if (!onboarding?.wsUrl) {
      firstBlockingReason = "openclaw_not_configured";
    } else if (!mainAgent) {
      firstBlockingReason = "main_agent_missing";
    } else if (incompleteAgents.length > 0) {
      firstBlockingReason = "agent_setup_incomplete";
    }

    return {
      openclawConfigured: Boolean(onboarding?.wsUrl),
      mainAgentId: mainAgent?._id ?? null,
      mainAgentReady: mainAgent
        ? !incompleteAgents.some((a) => String(a.id) === String(mainAgent._id))
        : false,
      incompleteCount: incompleteAgents.length,
      firstBlockingReason,
    };
  },
});
