import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireMember, requireRole } from "./lib/permissions";

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

export const upsertProfile = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    profileInput: profileInputValidator,
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "admin");
    const db = ctx.db as any;
    const now = Date.now();

    const existingActive = await db
      .query("autopilotProfiles")
      .withIndex("byWorkspaceAndActive", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("isActive", true),
      )
      .first();

    if (existingActive) {
      await db.patch(existingActive._id, {
        isActive: false,
        updatedAt: now,
      });
    }

    const nextVersion = (existingActive?.version ?? 0) + 1;

    const profileId = await db.insert("autopilotProfiles", {
      workspaceId: args.workspaceId,
      version: nextVersion,
      isActive: true,
      template: "business_onboarding_growth",
      ...args.profileInput,
      updatedBy: membership.userId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      profileId,
      version: nextVersion,
    };
  },
});

export const getProfile = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const db = ctx.db as any;
    return await db
      .query("autopilotProfiles")
      .withIndex("byWorkspaceAndActive", (q: any) =>
        q.eq("workspaceId", args.workspaceId).eq("isActive", true),
      )
      .first();
  },
});

export const runAutopilot = action({
  args: {
    workspaceId: v.id("workspaces"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    const workspace = await ctx.runQuery((api as any).workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) throw new Error("Workspace not found");
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      throw new Error("Only owner/admin can run autopilot");
    }

    const profile = await ctx.runQuery((internal as any).autopilot_internal.getActiveProfile, {
      workspaceId: args.workspaceId,
    });
    if (!profile) {
      throw new Error("Autopilot profile not found. Save the founder brief first.");
    }

    const context = await ctx.runQuery((internal as any).autopilot_internal.buildPlanningContext, {
      workspaceId: args.workspaceId,
    });

    const runId = await ctx.runMutation((internal as any).autopilot_internal.startRun, {
      workspaceId: args.workspaceId,
      triggeredBy: profile.updatedBy,
      triggerType: "manual",
      profileVersion: profile.version,
      inputSnapshot: context,
    });

    try {
      const draft = await ctx.runMutation((internal as any).autopilot_internal.generatePlanDraft, {
        profile: {
          businessStage: profile.businessStage,
          northStarMetric: profile.northStarMetric,
          weeklyGoal: profile.weeklyGoal,
          constraints: profile.constraints,
          channels: profile.channels,
          targetAudience: profile.targetAudience,
          timeBudgetHoursPerWeek: profile.timeBudgetHoursPerWeek,
          riskTolerance: profile.riskTolerance,
        },
        context,
        notes: args.notes,
      });

      const persisted = await ctx.runMutation((internal as any).autopilot_internal.persistRunArtifacts, {
        workspaceId: args.workspaceId,
        runId,
        profile: {
          businessStage: profile.businessStage,
          northStarMetric: profile.northStarMetric,
          weeklyGoal: profile.weeklyGoal,
          constraints: profile.constraints,
          channels: profile.channels,
          targetAudience: profile.targetAudience,
          timeBudgetHoursPerWeek: profile.timeBudgetHoursPerWeek,
          riskTolerance: profile.riskTolerance,
        },
        draft,
      });

      return {
        runId,
        ...persisted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation((internal as any).autopilot_internal.failRun, {
        workspaceId: args.workspaceId,
        runId,
        errorMessage: message,
      });
      throw error;
    }
  },
});

export const listRuns = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const db = ctx.db as any;
    const rows = await db
      .query("autopilotRuns")
      .withIndex("byWorkspaceAndCreatedAt", (q: any) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();

    const limit = Math.max(1, Math.min(100, args.limit ?? 20));
    return rows.slice(0, limit);
  },
});

export const getRun = query({
  args: {
    workspaceId: v.id("workspaces"),
    runId: v.id("autopilotRuns"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const row = await (ctx.db as any).get(args.runId);
    if (!row || row.workspaceId !== args.workspaceId) return null;
    return row;
  },
});

export const reprocessRun = action({
  args: {
    workspaceId: v.id("workspaces"),
    runId: v.id("autopilotRuns"),
  },
  handler: async (ctx, args): Promise<any> => {
    const workspace = await ctx.runQuery((api as any).workspaces.getById, {
      workspaceId: args.workspaceId,
    });

    if (!workspace) throw new Error("Workspace not found");
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      throw new Error("Only owner/admin can reprocess autopilot runs");
    }

    const existingRun = await ctx.runQuery((internal as any).autopilot_internal.getRunById, {
      workspaceId: args.workspaceId,
      runId: args.runId,
    });

    if (!existingRun) throw new Error("Run not found");

    const profile = await ctx.runQuery((internal as any).autopilot_internal.getActiveProfile, {
      workspaceId: args.workspaceId,
    });
    if (!profile) {
      throw new Error("Autopilot profile not found. Save the founder brief first.");
    }

    const runId = await ctx.runMutation((internal as any).autopilot_internal.startRun, {
      workspaceId: args.workspaceId,
      triggeredBy: profile.updatedBy,
      triggerType: "reprocess",
      profileVersion: profile.version,
      inputSnapshot: existingRun.inputSnapshot,
    });

    try {
      const draft = await ctx.runMutation((internal as any).autopilot_internal.generatePlanDraft, {
        profile: {
          businessStage: profile.businessStage,
          northStarMetric: profile.northStarMetric,
          weeklyGoal: profile.weeklyGoal,
          constraints: profile.constraints,
          channels: profile.channels,
          targetAudience: profile.targetAudience,
          timeBudgetHoursPerWeek: profile.timeBudgetHoursPerWeek,
          riskTolerance: profile.riskTolerance,
        },
        context: existingRun.inputSnapshot,
      });

      const persisted = await ctx.runMutation((internal as any).autopilot_internal.persistRunArtifacts, {
        workspaceId: args.workspaceId,
        runId,
        profile: {
          businessStage: profile.businessStage,
          northStarMetric: profile.northStarMetric,
          weeklyGoal: profile.weeklyGoal,
          constraints: profile.constraints,
          channels: profile.channels,
          targetAudience: profile.targetAudience,
          timeBudgetHoursPerWeek: profile.timeBudgetHoursPerWeek,
          riskTolerance: profile.riskTolerance,
        },
        draft,
      });

      return {
        runId,
        ...persisted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation((internal as any).autopilot_internal.failRun, {
        workspaceId: args.workspaceId,
        runId,
        errorMessage: message,
      });
      throw error;
    }
  },
});

export const getReminder = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const db = ctx.db as any;
    const runs = await db
      .query("autopilotRuns")
      .withIndex("byWorkspaceAndCreatedAt", (q: any) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    if (runs.length === 0) {
      return {
        hasCompletedRun: false,
        isStale: true,
        daysSinceLastCompletedRun: null,
      };
    }

    const latestCompleted = runs.find((run: any) => run.status === "completed") ?? null;
    if (!latestCompleted) {
      return {
        hasCompletedRun: false,
        isStale: true,
        daysSinceLastCompletedRun: null,
      };
    }

    const now = Date.now();
    const ageMs = now - (latestCompleted.completedAt ?? latestCompleted.startedAt);
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));

    return {
      hasCompletedRun: true,
      isStale: days > 7,
      daysSinceLastCompletedRun: days,
      runId: latestCompleted._id,
    };
  },
});
