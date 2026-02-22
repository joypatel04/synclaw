import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  buildDedupeKey,
  buildStrategyDocumentContent,
  computeRelevanceScore,
  firstNonEmpty,
  isCategoryBlocked,
  mapNegativeConstraintsToBlockedCategories,
  rankCandidates,
  type AutopilotProfileInput,
  type ModeOfWork,
  type PlanningTaskCandidate,
  type TaskCategory,
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
  modeOfWork: v.union(
    v.literal("building"),
    v.literal("operations_execution"),
    v.literal("closing"),
    v.literal("strategic_planning"),
    v.literal("technical_debt"),
  ),
  northStarMetric: v.string(),
  weeklyGoal: v.string(),
  constraints: v.array(v.string()),
  negativeConstraints: v.array(v.string()),
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
    const mode = profile.modeOfWork as ModeOfWork;
    const notesLower = (args.notes ?? "").toLowerCase();
    const allowsResearchByNotes =
      notesLower.includes("research") || notesLower.includes("interview");

    const weeklyObjective = firstNonEmpty(
      [
        args.notes,
        profile.weeklyGoal,
        `Improve ${profile.modeOfWork.replace(/_/g, " ")} outcomes for ${profile.targetAudience}`,
      ],
      "Improve execution outcomes this week",
    );

    const kpiTarget = `${profile.northStarMetric} +10% WoW`;

    type Seed = {
      actionType: string;
      category: TaskCategory;
      title: string;
      whyNow: string;
      priority: "high" | "medium" | "low" | "none";
      confidence: number;
      kpiImpactScore: number;
      acceptance: string[];
    };

    const candidateLibrary: Record<ModeOfWork, Seed[]> = {
      building: [
        {
          actionType: "instrumentation",
          category: "instrumentation",
          title: "Instrument onboarding funnel with stage-level drop-off tracking",
          whyNow:
            "You cannot improve conversion without reliable stage-by-stage visibility.",
          priority: "high",
          confidence: 0.86,
          kpiImpactScore: 3,
          acceptance: [
            "Track at least 5 onboarding checkpoints end-to-end.",
            "Create a daily conversion dashboard for the north-star metric.",
            "Alert on >10% drop at any step.",
          ],
        },
        {
          actionType: "funnel_redesign",
          category: "funnel_redesign",
          title: "Launch a guided first-value checklist in onboarding flow",
          whyNow: "Activation friction is currently reducing first-value completion.",
          priority: "high",
          confidence: 0.8,
          kpiImpactScore: 3,
          acceptance: [
            "Checklist has 3-5 critical actions mapped to first value.",
            "Each item emits completion telemetry.",
            "Completion rate is measurable by cohort.",
          ],
        },
        {
          actionType: "ab_test",
          category: "ab_test",
          title: "Ship one onboarding conversion experiment with success threshold",
          whyNow: "A focused test can validate which activation change is worth scaling.",
          priority: "medium",
          confidence: 0.7,
          kpiImpactScore: 2,
          acceptance: [
            "Define one variant and one control path.",
            "Set primary metric threshold before launch.",
            "Publish decision note: ship, iterate, or revert.",
          ],
        },
      ],
      operations_execution: [
        {
          actionType: "ops_sop",
          category: "ops_sop",
          title: "Create standardized SOP for manual profile completion",
          whyNow: "Consistent SOP removes variation and speeds up operator throughput.",
          priority: "high",
          confidence: 0.9,
          kpiImpactScore: 3,
          acceptance: [
            "Document step-by-step SOP for manual completion handoff.",
            "Define owner, SLA, and escalation path for each step.",
            "Run SOP on at least 5 live leads this week.",
          ],
        },
        {
          actionType: "ops_bottleneck",
          category: "ops_bottleneck",
          title: "Identify automation-to-manual bottlenecks in profile pipeline",
          whyNow: "Current 25-30% manual tail likely hides avoidable operational friction.",
          priority: "high",
          confidence: 0.88,
          kpiImpactScore: 3,
          acceptance: [
            "Map each pipeline stage with failure/rework reasons.",
            "Quantify bottleneck frequency and cycle-time impact.",
            "Recommend top 2 fixes with expected throughput gain.",
          ],
        },
        {
          actionType: "ops_tracking",
          category: "ops_tracking",
          title: "Build live ops dashboard for lead -> ready-to-live progression",
          whyNow: "Operators need shared visibility to prevent silent stalls.",
          priority: "high",
          confidence: 0.84,
          kpiImpactScore: 3,
          acceptance: [
            "Track lead count by stage: intake, automation, manual, ready-live.",
            "Show age-in-stage and stuck-item alerts.",
            "Review dashboard daily with owner and main agent.",
          ],
        },
        {
          actionType: "readiness_definition",
          category: "readiness_definition",
          title: "Define acceptance criteria for 'business profile ready to live'",
          whyNow: "Without explicit readiness rules, quality and speed both degrade.",
          priority: "medium",
          confidence: 0.82,
          kpiImpactScore: 2,
          acceptance: [
            "Define mandatory fields and quality checks.",
            "Add pass/fail checklist used by manual reviewers.",
            "Ensure every ready-live item is auditable.",
          ],
        },
        {
          actionType: "instrumentation",
          category: "instrumentation",
          title: "Track operator throughput and cycle-time per profile",
          whyNow: "Cycle-time instrumentation is required to improve weekly output reliably.",
          priority: "medium",
          confidence: 0.78,
          kpiImpactScore: 2,
          acceptance: [
            "Capture start-to-ready-live duration per profile.",
            "Report median and p90 cycle-time weekly.",
            "Flag outliers and attach root-cause tags.",
          ],
        },
      ],
      closing: [
        {
          actionType: "readiness_definition",
          category: "readiness_definition",
          title: "Define close-readiness criteria for pending business profiles",
          whyNow: "Closing faster requires a strict, shared ready-to-live definition.",
          priority: "high",
          confidence: 0.86,
          kpiImpactScore: 3,
          acceptance: [
            "Create close-readiness checklist per profile.",
            "Identify missing items for current top leads.",
            "Assign owners and due dates for each missing item.",
          ],
        },
        {
          actionType: "ops_bottleneck",
          category: "ops_bottleneck",
          title: "Resolve top handoff blockers between automation and manual closing",
          whyNow: "Handoff friction is the main reason leads do not reach live state.",
          priority: "high",
          confidence: 0.83,
          kpiImpactScore: 3,
          acceptance: [
            "List top 3 blocker patterns this week.",
            "Implement mitigation for each blocker.",
            "Measure blocker recurrence drop week-over-week.",
          ],
        },
        {
          actionType: "ops_tracking",
          category: "ops_tracking",
          title: "Create daily closing board with owner-level visibility",
          whyNow: "Daily visibility is required to hit short closing targets.",
          priority: "medium",
          confidence: 0.79,
          kpiImpactScore: 2,
          acceptance: [
            "Board shows every lead and current close state.",
            "Aging items highlighted with explicit next action.",
            "Daily review ritual logged in activity feed.",
          ],
        },
        {
          actionType: "ops_sop",
          category: "ops_sop",
          title: "Standardize final quality checks before going live",
          whyNow: "Standard final checks reduce rollback and rework costs after go-live.",
          priority: "medium",
          confidence: 0.76,
          kpiImpactScore: 2,
          acceptance: [
            "Define final QA checklist and evidence requirements.",
            "Apply checklist to all this week’s candidates.",
            "Record pass/fail outcomes with reasons.",
          ],
        },
      ],
      strategic_planning: [
        {
          actionType: "instrumentation",
          category: "instrumentation",
          title: "Define weekly decision dashboard for priority planning",
          whyNow: "Planning quality depends on transparent KPI movement and constraints.",
          priority: "high",
          confidence: 0.77,
          kpiImpactScore: 2,
          acceptance: [
            "Select 3 planning KPIs and baseline each.",
            "Capture risks, assumptions, and confidence each week.",
            "Publish weekly planning note with decisions.",
          ],
        },
        {
          actionType: "interviews",
          category: "interviews",
          title: "Run targeted discovery interviews for strategic unknowns",
          whyNow: "High-impact strategic choices need validated user context.",
          priority: "medium",
          confidence: 0.7,
          kpiImpactScore: 1,
          acceptance: [
            "Interview 3 target users on key unknowns.",
            "Summarize patterns and implications for roadmap.",
            "Convert findings into scoped tasks.",
          ],
        },
      ],
      technical_debt: [
        {
          actionType: "instrumentation",
          category: "instrumentation",
          title: "Instrument failure and latency hot paths in execution pipeline",
          whyNow: "Debt work should target measurable reliability and speed improvements.",
          priority: "high",
          confidence: 0.8,
          kpiImpactScore: 2,
          acceptance: [
            "Track top 3 failure and latency signals.",
            "Create weekly reliability trend report.",
            "Tie each issue to owner and mitigation task.",
          ],
        },
        {
          actionType: "ops_bottleneck",
          category: "ops_bottleneck",
          title: "Prioritize and fix highest-impact recurring operational defects",
          whyNow: "Recurring defects tax team throughput and delay product outcomes.",
          priority: "high",
          confidence: 0.78,
          kpiImpactScore: 2,
          acceptance: [
            "Rank defects by impact and recurrence.",
            "Fix top 2 defects with regression checks.",
            "Verify recurrence reduction in next cycle.",
          ],
        },
      ],
    };
    const candidatesSeed = candidateLibrary[mode] ?? [];

    const blockedCategories = mapNegativeConstraintsToBlockedCategories(
      profile.negativeConstraints ?? [],
    );

    const qualityFlags: string[] = [];
    const deferredSuggestions: Array<{
      title: string;
      reason: string;
      category: TaskCategory;
    }> = [];

    const taskCandidates: PlanningTaskCandidate[] = [];
    for (const seed of candidatesSeed) {
      const hardBlocked = isCategoryBlocked(seed.category, blockedCategories);
      if (hardBlocked) {
        deferredSuggestions.push({
          title: seed.title,
          reason: "blocked_by_negative_constraint",
          category: seed.category,
        });
        continue;
      }

      if (
        (mode === "operations_execution" || mode === "closing") &&
        (seed.category === "interviews" ||
          seed.category === "ab_test" ||
          seed.category === "funnel_redesign") &&
        !allowsResearchByNotes
      ) {
        deferredSuggestions.push({
          title: seed.title,
          reason: "irrelevant_for_current_mode",
          category: seed.category,
        });
        continue;
      }

      const relevance = computeRelevanceScore(mode, seed.category, {
        staleTaskCount: context.staleTaskCount,
        openTaskCount: context.openTaskCount,
      });
      if (relevance <= 0) {
        deferredSuggestions.push({
          title: seed.title,
          reason: "mode_relevance_below_threshold",
          category: seed.category,
        });
        continue;
      }

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
        category: seed.category,
      });
    }

    const ranked = rankCandidates(taskCandidates).slice(0, 5);

    const hasOpsTracking = ranked.some(
      (candidate) =>
        candidate.category === "ops_tracking" ||
        candidate.category === "instrumentation",
    );
    const hasThroughput = ranked.some(
      (candidate) =>
        candidate.category === "ops_bottleneck" ||
        candidate.category === "ops_sop" ||
        candidate.category === "readiness_definition",
    );
    if (
      (mode === "operations_execution" || mode === "closing") &&
      !hasOpsTracking
    ) {
      qualityFlags.push("missing_operational_tracking_task");
    }
    if (
      (mode === "operations_execution" || mode === "closing") &&
      !hasThroughput
    ) {
      qualityFlags.push("missing_execution_throughput_task");
    }

    const assumptions = [
      `Current focus: ${profile.weeklyGoal}`,
      `Mode of work: ${profile.modeOfWork}`,
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

    if (ranked.length < 3) {
      throw new Error(
        "Autopilot generated fewer than 3 relevant tasks after exclusions. Relax constraints or adjust mode of work.",
      );
    }

    if (ranked.every((candidate) => candidate.confidence < 0.5)) {
      throw new Error(
        "Autopilot confidence too low. Add clearer weekly goal and north-star metric before running again.",
      );
    }

    return {
      template: "business_onboarding_growth",
      horizonDays: 7,
      modeOfWork: mode,
      blockedCategories,
      weeklyObjective,
      kpiTarget,
      taskCandidates: ranked,
      deferredSuggestions,
      qualityFlags,
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
      blockedCategories: Array.isArray(draft.blockedCategories)
        ? draft.blockedCategories
        : [],
      deferredSuggestions: Array.isArray(draft.deferredSuggestions)
        ? draft.deferredSuggestions
        : [],
      qualityFlags: Array.isArray(draft.qualityFlags) ? draft.qualityFlags : [],
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
      modeOfWork: draft.modeOfWork ?? args.profile.modeOfWork,
      blockedCategories: Array.isArray(draft.blockedCategories)
        ? draft.blockedCategories
        : [],
      deferredSuggestions: Array.isArray(draft.deferredSuggestions)
        ? draft.deferredSuggestions
        : [],
      qualityFlags: Array.isArray(draft.qualityFlags) ? draft.qualityFlags : [],
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
        category: task.category,
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
