import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, mutation, query } from "./_generated/server";
import { requireMember, requireRole } from "./lib/permissions";
import {
  buildAgentSetupFiles,
  deriveRoleModule,
  deriveWorkspaceFolderPath,
  REQUIRED_AGENT_SETUP_FILES,
  type AgentSetupSource,
} from "../lib/agentSetupTemplates";

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

type FileCheckRecord = Record<
  string,
  {
    exists: boolean;
    hash?: string;
    confirmedAt?: number;
    source: AgentSetupSource;
  }
>;

type SetupRow = {
  bootstrapPrimedAt?: number;
  heartbeatConfirmedAt?: number;
  cronConfirmedAt?: number;
  protocolConfirmedAt?: number;
  localFilesWrittenAt?: number;
  requiredFilesConfirmedAt?: number;
  fileChecks?: FileCheckRecord;
  lastValidationAt?: number;
  lastValidationErrors?: string[];
};

function allRequiredFilesConfirmed(fileChecks: FileCheckRecord | undefined) {
  if (!fileChecks) return false;
  return REQUIRED_AGENT_SETUP_FILES.every((name) => {
    const row = fileChecks[name];
    return Boolean(row?.exists && row?.confirmedAt);
  });
}

function deriveSetupStatus(row: SetupRow | null, hasPulse: boolean) {
  const bootstrapPrimed = Boolean(row?.bootstrapPrimedAt);
  const heartbeatConfirmed = Boolean(row?.heartbeatConfirmedAt);
  const cronConfirmed = Boolean(row?.cronConfirmedAt);
  const protocolConfirmed = Boolean(row?.protocolConfirmedAt);
  const localFilesWritten = Boolean(row?.localFilesWrittenAt);
  const requiredFilesConfirmed = allRequiredFilesConfirmed(row?.fileChecks);
  const pulseDetected = hasPulse;

  const isComplete =
    bootstrapPrimed && cronConfirmed && requiredFilesConfirmed && pulseDetected;

  return {
    bootstrapPrimed,
    heartbeatConfirmed,
    cronConfirmed,
    protocolConfirmed,
    localFilesWritten,
    requiredFilesConfirmed,
    pulseDetected,
    fileChecks: row?.fileChecks ?? {},
    lastValidationAt: row?.lastValidationAt ?? null,
    lastValidationErrors: row?.lastValidationErrors ?? [],
    isComplete,
    timestamps: {
      bootstrapPrimedAt: row?.bootstrapPrimedAt ?? null,
      heartbeatConfirmedAt: row?.heartbeatConfirmedAt ?? null,
      cronConfirmedAt: row?.cronConfirmedAt ?? null,
      protocolConfirmedAt: row?.protocolConfirmedAt ?? null,
      localFilesWrittenAt: row?.localFilesWrittenAt ?? null,
      requiredFilesConfirmedAt: row?.requiredFilesConfirmedAt ?? null,
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

function contentErrorsForFile(args: {
  filename: string;
  content: string;
  agentName: string;
  agentRole: string;
  sessionKey: string;
  workspaceId: string;
}): string[] {
  const lower = args.content.toLowerCase();
  if (!args.content.trim()) return [`${args.filename} is empty`];

  switch (args.filename) {
    case "IDENTITY.md":
      return [
        !args.content.includes(args.agentName) ? "Missing agent name" : "",
        !args.content.includes(args.sessionKey) ? "Missing session key" : "",
        !args.content.includes(args.agentRole) ? "Missing role" : "",
      ].filter(Boolean);
    case "USER.md":
      return [
        !lower.includes("timezone") ? "Missing timezone section" : "",
        !lower.includes("ground rules") ? "Missing ground rules section" : "",
      ].filter(Boolean);
    case "SOUL.md":
      return [
        !lower.includes("you are") ? "Missing identity narrative" : "",
        !lower.includes("role") ? "Missing role section" : "",
      ].filter(Boolean);
    case "TOOLS.md":
      return [
        !lower.includes("mcporter") ? "Missing mcporter rule" : "",
        !lower.includes("lightpanda") ? "Missing scraping policy" : "",
      ].filter(Boolean);
    case "HEARTBEAT.md":
      return [
        !args.content.includes(args.sessionKey)
          ? "Missing session key in heartbeat"
          : "",
        !lower.includes("sutraha_agent_pulse") ? "Missing pulse call" : "",
      ].filter(Boolean);
    case "AGENTS.md":
      return [
        !args.content.includes(args.sessionKey)
          ? "Current agent session key not listed"
          : "",
        !lower.includes("agent identity")
          ? "Missing agent identity section"
          : "",
      ].filter(Boolean);
    case "SYNCLAW_PROTOCOL.md":
      return [
        !lower.includes("sutraha") && !lower.includes("synclaw")
          ? "Missing Synclaw/Sutraha backend context"
          : "",
        !args.content.includes(args.workspaceId)
          ? "Missing workspaceId reference"
          : "",
        !lower.includes("stage 1") ? "Missing staged workflow" : "",
        !lower.includes("sutraha_agent_pulse") ? "Missing pulse stage" : "",
      ].filter(Boolean);
    default:
      return [];
  }
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
      requiredFiles: REQUIRED_AGENT_SETUP_FILES,
      ...deriveSetupStatus(
        row,
        Boolean(agent.lastPulseAt && agent.lastPulseAt > 0),
      ),
    };
  },
});

export const getSetupPlan = query({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const agent = await getAgent(ctx, args.workspaceId, args.agentId);
    const agents = await ctx.db
      .query("agents")
      .withIndex("byWorkspace", (q: any) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .collect();

    const files = buildAgentSetupFiles({
      workspaceId: String(args.workspaceId),
      workspaceName: workspace.name,
      humanName: "Joy Patel",
      humanTimezone: "Asia/Kolkata",
      recommendedHeartbeatMinutes:
        agent.sessionKey === "agent:main:main" ? 720 : 60,
      roleModule: deriveRoleModule({
        role: agent.role,
        sessionKey: agent.sessionKey,
      }),
      agent: {
        id: String(agent._id),
        name: agent.name,
        role: agent.role,
        emoji: agent.emoji,
        sessionKey: agent.sessionKey,
        externalAgentId: agent.externalAgentId ?? undefined,
        workspaceFolderPath: deriveWorkspaceFolderPath({
          name: agent.name,
          sessionKey: agent.sessionKey,
          workspaceFolderPath: agent.workspaceFolderPath,
        }),
      },
      agents: agents
        .filter((a: any) => !a.isArchived)
        .map((a: any) => ({
          id: String(a._id),
          name: a.name,
          role: a.role,
          emoji: a.emoji,
          sessionKey: a.sessionKey,
          externalAgentId: a.externalAgentId ?? undefined,
          workspaceFolderPath: deriveWorkspaceFolderPath({
            name: a.name,
            sessionKey: a.sessionKey,
            workspaceFolderPath: a.workspaceFolderPath,
          }),
        })),
    });

    return {
      agent: {
        id: agent._id,
        name: agent.name,
        role: agent.role,
        emoji: agent.emoji,
        sessionKey: agent.sessionKey,
        workspaceFolderPath: deriveWorkspaceFolderPath({
          name: agent.name,
          sessionKey: agent.sessionKey,
          workspaceFolderPath: agent.workspaceFolderPath,
        }),
      },
      requiredFiles: REQUIRED_AGENT_SETUP_FILES,
      files,
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
        setupVersion: 2,
        updatedBy: membership.userId,
        updatedAt: now,
      };
      base[field] = now;
      await ctx.db.insert("agentSetupProgress", base);
      return {
        agentId: args.agentId,
        ...deriveSetupStatus(
          base,
          Boolean(agent.lastPulseAt && agent.lastPulseAt > 0),
        ),
      };
    }

    const patch: any = {
      setupVersion: 2,
      updatedBy: membership.userId,
      updatedAt: now,
    };
    patch[field] = now;

    await ctx.db.patch(row._id, patch);
    const next = { ...row, ...patch };

    return {
      agentId: args.agentId,
      ...deriveSetupStatus(
        next,
        Boolean(agent.lastPulseAt && agent.lastPulseAt > 0),
      ),
    };
  },
});

export const confirmFile = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    filename: v.string(),
    hash: v.optional(v.string()),
    source: v.union(
      v.literal("template"),
      v.literal("manual"),
      v.literal("chat"),
    ),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    await getAgent(ctx, args.workspaceId, args.agentId);

    const row = await ctx.db
      .query("agentSetupProgress")
      .withIndex("byWorkspaceAndAgent", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("agentId", args.agentId),
      )
      .first();

    const now = Date.now();
    const existingChecks: FileCheckRecord = row?.fileChecks ?? {};
    const nextChecks: FileCheckRecord = {
      ...existingChecks,
      [args.filename]: {
        exists: true,
        hash: args.hash,
        confirmedAt: now,
        source: args.source,
      },
    };

    const requiredFilesConfirmedAt = allRequiredFilesConfirmed(nextChecks)
      ? now
      : row?.requiredFilesConfirmedAt;

    if (!row) {
      await ctx.db.insert("agentSetupProgress", {
        workspaceId: args.workspaceId,
        agentId: args.agentId,
        setupVersion: 2,
        fileChecks: nextChecks,
        requiredFilesConfirmedAt,
        updatedBy: membership.userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(row._id, {
        setupVersion: 2,
        fileChecks: nextChecks,
        requiredFilesConfirmedAt,
        updatedBy: membership.userId,
        updatedAt: now,
      });
    }

    return { ok: true };
  },
});

export const persistValidation = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    fileChecks: v.record(
      v.string(),
      v.object({
        exists: v.boolean(),
        hash: v.optional(v.string()),
        confirmedAt: v.optional(v.number()),
        source: v.union(
          v.literal("template"),
          v.literal("manual"),
          v.literal("chat"),
        ),
      }),
    ),
    errors: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    await getAgent(ctx, args.workspaceId, args.agentId);
    const now = Date.now();

    const row = await ctx.db
      .query("agentSetupProgress")
      .withIndex("byWorkspaceAndAgent", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("agentId", args.agentId),
      )
      .first();

    const requiredFilesConfirmedAt = allRequiredFilesConfirmed(args.fileChecks)
      ? now
      : row?.requiredFilesConfirmedAt;

    const patch = {
      setupVersion: 2,
      fileChecks: args.fileChecks,
      requiredFilesConfirmedAt,
      lastValidationAt: now,
      lastValidationErrors: args.errors,
      updatedBy: membership.userId,
      updatedAt: now,
    };

    if (!row) {
      await ctx.db.insert("agentSetupProgress", {
        workspaceId: args.workspaceId,
        agentId: args.agentId,
        ...patch,
      });
    } else {
      await ctx.db.patch(row._id, patch);
    }

    return { ok: true };
  },
});

export const validateSetup = action({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const status = await ctx.runQuery(api.agentSetup.getStatus, {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
    });
    const setupPlan = await ctx.runQuery(api.agentSetup.getSetupPlan, {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
    });

    const basePath = setupPlan.agent.workspaceFolderPath;
    const now = Date.now();
    const fileChecks: FileCheckRecord = {};
    const errors: string[] = [];

    for (const filename of REQUIRED_AGENT_SETUP_FILES) {
      try {
        const result: any = await ctx.runAction(api.openclaw_files.readFile, {
          workspaceId: args.workspaceId,
          basePath,
          path: filename,
        });
        const content = String(result?.content ?? "");
        const localErrors = contentErrorsForFile({
          filename,
          content,
          agentName: setupPlan.agent.name,
          agentRole: setupPlan.agent.role,
          sessionKey: setupPlan.agent.sessionKey,
          workspaceId: String(args.workspaceId),
        });
        if (localErrors.length > 0) {
          for (const msg of localErrors) {
            errors.push(`${filename}: ${msg}`);
          }
          fileChecks[filename] = {
            exists: true,
            hash: result?.hash,
            source: "manual",
          };
        } else {
          fileChecks[filename] = {
            exists: true,
            hash: result?.hash,
            confirmedAt: now,
            source: "manual",
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fileChecks[filename] = {
          exists: false,
          source: "manual",
        };
        errors.push(`${filename}: ${message}`);
      }
    }

    if (!status.bootstrapPrimed) {
      errors.push("Setup step missing: bootstrap not confirmed");
    }
    if (!status.cronConfirmed) {
      errors.push("Setup step missing: cron not confirmed");
    }
    if (!status.pulseDetected) {
      errors.push("Runtime signal missing: first pulse not detected");
    }

    await ctx.runMutation(api.agentSetup.persistValidation, {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
      fileChecks,
      errors,
    });

    return {
      ok: errors.length === 0,
      errors,
      fileChecks,
      requiredFiles: REQUIRED_AGENT_SETUP_FILES,
    };
  },
});

export const applySetupFiles = action({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    operations: v.array(
      v.object({
        filename: v.string(),
        mode: v.union(
          v.literal("create"),
          v.literal("replace"),
          v.literal("skip"),
        ),
        content: v.optional(v.string()),
        source: v.union(
          v.literal("template"),
          v.literal("manual"),
          v.literal("chat"),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const setupPlan = await ctx.runQuery(api.agentSetup.getSetupPlan, {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
    });

    const applied: string[] = [];
    const basePath = setupPlan.agent.workspaceFolderPath;

    for (const op of args.operations) {
      if (op.mode === "skip") continue;
      const filename = op.filename;
      const fallbackContent = (setupPlan.files as any)[filename];
      const content = op.content ?? fallbackContent;
      if (!content || typeof content !== "string") {
        throw new Error(`Missing content for ${filename}`);
      }

      const writeResult: any = await ctx.runAction(
        api.openclaw_files.writeFile,
        {
          workspaceId: args.workspaceId,
          basePath,
          path: filename,
          content,
        },
      );

      await ctx.runMutation(api.agentSetup.confirmFile, {
        workspaceId: args.workspaceId,
        agentId: args.agentId,
        filename,
        hash: writeResult?.hash,
        source: op.source,
      });
      applied.push(filename);
    }

    await ctx.runMutation(api.agentSetup.markStep, {
      workspaceId: args.workspaceId,
      agentId: args.agentId,
      step: "localFilesWritten",
    });

    return { ok: true, applied };
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

    const mainAgent =
      agents.find((a) => a.sessionKey === "agent:main:main") ?? null;

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
