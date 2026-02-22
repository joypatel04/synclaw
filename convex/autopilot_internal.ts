import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  buildDedupeKey,
  buildStrategyDocumentContent,
  firstNonEmpty,
  rankCandidates,
  type AutopilotProfileInput,
  type PlanningTaskCandidate,
} from "./lib/autopilot";

const MAIN_AGENT_SESSION_KEY = "agent:main:main";

const profileInputValidator = v.object({
  businessStage: v.union(
    v.literal("idea"),
    v.literal("pre_launch"),
    v.literal("onboarding"),
    v.literal("early_revenue"),
    v.literal("growth"),
  ),
  northStarMetric: v.string(),
  weeklyGoal: v.string(),
  constraints: v.array(v.string()),
  channels: v.array(v.string()),
  targetAudience: v.string(),
  timeBudgetHoursPerWeek: v.number(),
  riskTolerance: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
});

function ensureRunShape(run: any) {
  if (!run || typeof run !== "object") {
    throw new Error("Autopilot run record not found");
  }
}

function formatAcceptanceCriteria(lines: string[]): string {
  return lines.map((line) => `- [ ] ${line}`).join("\n");
}

export const buildPlanningContext = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const now = Date.now();
    const staleCutoff = now - 14 * 24 * 60 * 60 * 1000;
    const recentCutoff = now - 7 * 24 * 60 * 60 * 1000;

    const tasks = await db
      .query("tasks")
      .withIndex("byWorkspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const openTasks = tasks.filter((task: any) => task.status !== "done");
    const staleTasks = openTasks.filter((task: any) => task.updatedAt <= staleCutoff);

    const activities = await db
      .query("activities")
      .withIndex("byWorkspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    const recentActivities = activities
      .filter((activity: any) => activity.createdAt >= recentCutoff)
      .slice(0, 30);

    const docs = await db
      .query("documents")
      .withIndex("byWorkspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    const keyDocs = docs
      .filter(
        (doc: any) =>
          doc.isGlobalContext ||
          doc.title.toLowerCase().includes("weekly autopilot plan") ||
          doc.type === "deliverable",
      )
      .slice(0, 10)
      .map((doc: any) => ({
        id: doc._id,
        title: doc.title,
        type: doc.type,
        status: doc.status,
        updatedAt: doc.updatedAt ?? doc.createdAt,
      }));

    const agents = await db
      .query("agents")
      .withIndex("byWorkspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const activeAgents = agents.filter((agent: any) => !agent.isArchived);
    const mainAgent =
      activeAgents.find((agent: any) => agent.sessionKey === MAIN_AGENT_SESSION_KEY) ?? null;

    return {
      now,
      openTaskCount: openTasks.length,
      staleTaskCount: staleTasks.length,
      openTasks: openTasks.slice(0, 40).map((task: any) => ({
        id: task._id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeIds: task.assigneeIds,
        updatedAt: task.updatedAt,
      })),
      staleTasks: staleTasks.slice(0, 20).map((task: any) => ({
        id: task._id,
        title: task.title,
        priority: task.priority,
        updatedAt: task.updatedAt,
      })),
      recentActivities: recentActivities.map((activity: any) => ({
        id: activity._id,
        type: activity.type,
        message: activity.message,
        createdAt: activity.createdAt,
      })),
      keyDocs,
      agentSummary: {
        total: activeAgents.length,
        active: activeAgents.filter((agent: any) => agent.status === "active").length,
        idle: activeAgents.filter((agent: any) => agent.status === "idle").length,
        hasMainAgent: Boolean(mainAgent),
      },
      mainAgentId: mainAgent?._id ?? null,
      mainAgentSessionKey: mainAgent?.sessionKey ?? MAIN_AGENT_SESSION_KEY,
    };
  },
});

export const getActiveProfile = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    return await db
      .query("autopilotProfiles")
      .withIndex("byWorkspaceAndActive", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("isActive", true),
      )
      .first();
  },
});

export const getRunById = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    runId: v.id("autopilotRuns"),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const row = await db.get(args.runId);
    if (!row || row.workspaceId !== args.workspaceId) return null;
    return row;
  },
});

export const startRun = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    triggeredBy: v.id("users"),
    triggerType: v.union(v.literal("manual"), v.literal("reprocess")),
    profileVersion: v.number(),
    inputSnapshot: v.any(),
  },
  handler: async (ctx, args) => {
    return await (ctx.db as any).insert("autopilotRuns", {
      workspaceId: args.workspaceId,
      triggeredBy: args.triggeredBy,
      triggerType: args.triggerType,
      status: "queued",
      profileVersion: args.profileVersion,
      inputSnapshot: args.inputSnapshot,
      outputSummary: {},
      createdTaskIds: [],
      startedAt: Date.now(),
    });
  },
});

export const generatePlanDraft = internalMutation({
  args: {
    profile: profileInputValidator,
    context: v.any(),
    notes: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const profile = args.profile as AutopilotProfileInput;
    const context = (args.context ?? {}) as any;
    const now = Date.now();
    const stage = profile.businessStage;

    const weeklyObjective = firstNonEmpty(
      [
        args.notes,
        profile.weeklyGoal,
        `Improve onboarding conversion for ${profile.targetAudience}`,
      ],
      "Improve onboarding conversion this week",
    );

    const kpiTarget = `${profile.northStarMetric} +10% WoW`;

    const candidatesSeed: Array<{
      actionType: string;
      title: string;
      whyNow: string;
      priority: "high" | "medium" | "low" | "none";
      confidence: number;
      kpiImpactScore: number;
      acceptance: string[];
    }> = [
      {
        actionType: "instrumentation",
        title: "Instrument onboarding funnel with stage-level drop-off tracking",
        whyNow:
          "You cannot improve conversion without reliable stage-by-stage visibility.",
        priority: "high" as const,
        confidence: 0.88,
        kpiImpactScore: 3,
        acceptance: [
          "Track at least 5 onboarding checkpoints end-to-end.",
          "Create a daily conversion dashboard for the north-star metric.",
          "Alert on >10% drop at any step.",
        ],
      },
      {
        actionType: "activation",
        title: "Launch a guided first-value checklist in onboarding flow",
        whyNow:
          "Activation lag is typically the largest early bottleneck in onboarding-stage products.",
        priority: stage === "onboarding" || stage === "pre_launch" ? "high" : "medium",
        confidence: 0.82,
        kpiImpactScore: 3,
        acceptance: [
          "Checklist has 3-5 critical actions mapped to first value.",
          "Each item emits completion telemetry.",
          "At least 20% of new users complete checklist in test cohort.",
        ],
      },
      {
        actionType: "retention",
        title: "Set up onboarding recovery sequence for stalled users",
        whyNow:
          "Stalled users usually represent the fastest recoverable conversion wins.",
        priority: "medium" as const,
        confidence: 0.76,
        kpiImpactScore: 2,
        acceptance: [
          "Define stalled-user trigger conditions.",
          "Create 2 re-engagement messages with clear CTA.",
          "Measure reactivation rate over 7 days.",
        ],
      },
      {
        actionType: "friction_research",
        title: "Run 5 friction interviews with onboarding drop-off users",
        whyNow:
          "Qualitative friction insights reduce wasted build cycles and improve targeting.",
        priority: profile.riskTolerance === "low" ? "medium" : "low",
        confidence: 0.67,
        kpiImpactScore: 1,
        acceptance: [
          "Interview 5 users who dropped in onboarding.",
          "Cluster findings into top 3 friction themes.",
          "Map each friction to one mitigation task.",
        ],
      },
      {
        actionType: "experiment",
        title: "Ship one onboarding conversion experiment with success threshold",
        whyNow:
          "Weekly experiments create predictable learning loops and compounding growth.",
        priority: "medium" as const,
        confidence: 0.74,
        kpiImpactScore: 2,
        acceptance: [
          "Define one variant and one control path.",
          "Set primary metric threshold before launch.",
          "Publish decision note: ship, iterate, or revert.",
        ],
      },
    ];

    const taskCandidates: PlanningTaskCandidate[] = [];
    for (const seed of candidatesSeed) {
      const dueAt = now + 6 * 24 * 60 * 60 * 1000;
      const description = [
        `Objective: ${weeklyObjective}`,
        `North-star metric: ${profile.northStarMetric}`,
        `Why now: ${seed.whyNow}`,
        "",
        "Acceptance criteria:",
        formatAcceptanceCriteria(seed.acceptance),
        "",
        `Context fit: Stage=${profile.businessStage}, Audience=${profile.targetAudience}`,
      ].join("\n");
      const dedupeKey = await buildDedupeKey({
        title: seed.title,
        primaryKpi: profile.northStarMetric,
        targetSegment: profile.targetAudience,
        actionType: seed.actionType,
      });
      taskCandidates.push({
        title: seed.title,
        description,
        priority: seed.priority,
        status: "inbox",
        assigneeSessionKey: context.mainAgentSessionKey ?? MAIN_AGENT_SESSION_KEY,
        dueAt,
        whyNow: seed.whyNow,
        dedupeKey,
        confidence: seed.confidence,
        kpiImpactScore: seed.kpiImpactScore,
        actionType: seed.actionType,
      });
    }

    const ranked = rankCandidates(taskCandidates).slice(0, 5);

    const assumptions = [
      `Current focus: ${profile.weeklyGoal}`,
      `Available execution budget: ~${profile.timeBudgetHoursPerWeek} hours this week`,
      `Primary audience: ${profile.targetAudience}`,
    ];
    const risks = [
      "Insufficient event instrumentation can block KPI attribution.",
      "Limited execution bandwidth may delay medium-priority tasks.",
      "Channel-message fit risk if audience intent is unclear.",
    ];
    const blockedBy = [
      "Main agent unavailable or misconfigured",
      "Onboarding telemetry not wired end-to-end",
      "No owner review for experiment outcomes",
    ];

    if (ranked.every((candidate) => candidate.confidence < 0.5)) {
      throw new Error(
        "Autopilot confidence too low. Add clearer weekly goal and north-star metric before running again.",
      );
    }

    return {
      template: "business_onboarding_growth",
      horizonDays: 7,
      weeklyObjective,
      kpiTarget,
      taskCandidates: ranked,
      assumptions,
      risks,
      blockedBy,
      contextSummary: {
        openTaskCount: context.openTaskCount ?? 0,
        staleTaskCount: context.staleTaskCount ?? 0,
        recentActivityCount: Array.isArray(context.recentActivities)
          ? context.recentActivities.length
          : 0,
      },
    };
  },
});

export const persistRunArtifacts = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    runId: v.id("autopilotRuns"),
    profile: profileInputValidator,
    draft: v.any(),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const run = await db.get(args.runId);
    ensureRunShape(run);
    if (run.workspaceId !== args.workspaceId) {
      throw new Error("Run does not belong to workspace");
    }

    await db.patch(args.runId, {
      status: "processing",
    });

    const agents = await db
      .query("agents")
      .withIndex("byWorkspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const activeAgents = agents.filter((agent: any) => !agent.isArchived);
    const mainAgent =
      activeAgents.find((agent: any) => agent.sessionKey === MAIN_AGENT_SESSION_KEY) ?? null;
    const fallbackAgent = activeAgents[0] ?? null;
    const docAgent = mainAgent ?? fallbackAgent;

    if (!docAgent) {
      throw new Error("No available agent found. Create at least one agent before running autopilot.");
    }

    const existingTasks = await db
      .query("tasks")
      .withIndex("byWorkspace", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const openTasks = existingTasks.filter((task: any) => task.status !== "done");

    const dedupeSet = new Set<string>();

    for (const task of openTasks) {
      const key = await buildDedupeKey({
        title: task.title,
        primaryKpi: args.profile.northStarMetric,
        targetSegment: args.profile.targetAudience,
        actionType: "execution",
      });
      dedupeSet.add(key);
    }

    const existingLinks = await db
      .query("autopilotTaskLinks")
      .withIndex("byWorkspaceAndDedupeKey", (q: any) => q.eq("workspaceId", args.workspaceId))
      .collect();
    for (const link of existingLinks) {
      dedupeSet.add(link.dedupeKey);
    }

    const draft = args.draft as any;
    const candidates = Array.isArray(draft.taskCandidates)
      ? (draft.taskCandidates as PlanningTaskCandidate[])
      : [];

    const selected: PlanningTaskCandidate[] = [];
    const skipped: Array<{ title: string; reason: string }> = [];

    for (const candidate of candidates) {
      if (!candidate?.title || !candidate?.dedupeKey) continue;
      if (dedupeSet.has(candidate.dedupeKey)) {
        skipped.push({
          title: candidate.title,
          reason: "duplicate_open_backlog",
        });
        continue;
      }
      selected.push(candidate);
      dedupeSet.add(candidate.dedupeKey);
      if (selected.length >= 5) break;
    }

    const dateLabel = new Date().toISOString().slice(0, 10);
    const strategyTitle = `Weekly Autopilot Plan - ${dateLabel}`;
    const strategyContent = buildStrategyDocumentContent({
      objective: draft.weeklyObjective ?? "Weekly growth objective",
      kpiTarget: draft.kpiTarget ?? args.profile.northStarMetric,
      profile: args.profile,
      assumptions: Array.isArray(draft.assumptions) ? draft.assumptions : [],
      risks: Array.isArray(draft.risks) ? draft.risks : [],
      blockedBy: Array.isArray(draft.blockedBy) ? draft.blockedBy : [],
      selected,
      skipped,
    });

    const now = Date.now();
    const documentId = await db.insert("documents", {
      workspaceId: args.workspaceId,
      title: strategyTitle,
      content: strategyContent,
      agentId: docAgent._id,
      lastEditedBy: docAgent._id,
      type: "deliverable",
      status: "draft",
      taskId: null,
      isGlobalContext: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "document_created",
      agentId: docAgent._id,
      taskId: null,
      message: `Autopilot created doc "${strategyTitle}"`,
      metadata: {
        documentId,
        source: "autopilot",
        runId: args.runId,
      },
      createdAt: now,
    });

    const createdTaskIds: Id<"tasks">[] = [];
    for (const candidate of selected) {
      const assignee =
        activeAgents.find((agent: any) => agent.sessionKey === candidate.assigneeSessionKey) ?? mainAgent;
      const assigneeIds = assignee ? [assignee._id] : [];
      const status = assigneeIds.length > 0 ? "assigned" : "inbox";
      const taskId = await db.insert("tasks", {
        workspaceId: args.workspaceId,
        title: candidate.title,
        description: candidate.description,
        status,
        assigneeIds,
        priority: candidate.priority,
        createdBy: "Autopilot",
        dueAt: candidate.dueAt ?? null,
        createdAt: now,
        updatedAt: now,
      });
      createdTaskIds.push(taskId);

      await db.insert("activities", {
        workspaceId: args.workspaceId,
        type: "task_created",
        agentId: assignee?._id ?? null,
        taskId,
        message: `Autopilot created task "${candidate.title}"`,
        metadata: {
          source: "autopilot",
          runId: args.runId,
          dedupeKey: candidate.dedupeKey,
          whyNow: candidate.whyNow,
        },
        createdAt: now,
      });

      await db.insert("autopilotTaskLinks", {
        workspaceId: args.workspaceId,
        runId: args.runId,
        taskId,
        dedupeKey: candidate.dedupeKey,
        createdAt: now,
      });
    }

    const outputSummary = {
      weeklyObjective: draft.weeklyObjective,
      kpiTarget: draft.kpiTarget,
      selectedCount: selected.length,
      skippedCount: skipped.length,
      skipped,
      assumptions: draft.assumptions ?? [],
      risks: draft.risks ?? [],
      blockedBy: draft.blockedBy ?? [],
      selectedTasks: selected.map((task) => ({
        title: task.title,
        priority: task.priority,
        confidence: task.confidence,
        dedupeKey: task.dedupeKey,
        whyNow: task.whyNow,
      })),
    };

    await db.patch(args.runId, {
      status: "completed",
      outputSummary,
      createdTaskIds,
      createdDocumentId: documentId,
      completedAt: Date.now(),
      errorMessage: undefined,
    });

    return {
      runId: args.runId,
      createdTaskIds,
      createdDocumentId: documentId,
      outputSummary,
    };
  },
});

export const failRun = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    runId: v.id("autopilotRuns"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const run = await db.get(args.runId);
    ensureRunShape(run);
    if (run.workspaceId !== args.workspaceId) {
      throw new Error("Run does not belong to workspace");
    }

    await db.patch(args.runId, {
      status: "failed",
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
    });
  },
});
