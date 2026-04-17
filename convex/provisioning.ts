import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "./lib/permissions";

function asSetupStatus(input?: string) {
  if (
    input === "infra_ready" ||
    input === "openclaw_ready" ||
    input === "agents_ready" ||
    input === "verified"
  ) {
    return input;
  }
  return "not_started";
}

export const createJob = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider: v.string(),
    targetHostType: v.union(
      v.literal("customer_vps"),
      v.literal("synclaw_managed"),
    ),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const now = Date.now();
    const jobId = await ctx.db.insert("openclawProvisioningJobs", {
      workspaceId: args.workspaceId,
      provider: args.provider.trim() || "manual",
      targetHostType: args.targetHostType,
      status: "queued",
      step: "queued",
      logs: [
        `[${new Date(now).toISOString()}] Provisioning request created by ${membership.userId}`,
      ],
      createdBy: membership.userId,
      createdAt: now,
      updatedAt: now,
    });

    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        provisioningMode: args.targetHostType,
        setupStatus: "not_started",
        updatedAt: now,
        updatedBy: membership.userId,
      });
    }

    return { ok: true, jobId };
  },
});

export const listJobs = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    return await ctx.db
      .query("openclawProvisioningJobs")
      .withIndex("byWorkspaceAndCreatedAt", (q) =>
        q.eq("workspaceId", args.workspaceId),
      )
      .order("desc")
      .take(20);
  },
});

export const getJobStatus = query({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) {
      throw new Error("Provisioning job not found");
    }
    return job;
  },
});

export const retryJob = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const original = await ctx.db.get(args.jobId);
    if (!original || original.workspaceId !== args.workspaceId) {
      throw new Error("Provisioning job not found");
    }
    const now = Date.now();
    const retryId = await ctx.db.insert("openclawProvisioningJobs", {
      workspaceId: args.workspaceId,
      provider: original.provider,
      targetHostType: original.targetHostType,
      status: "queued",
      step: "queued",
      logs: [
        `[${new Date(now).toISOString()}] Retry created from job ${args.jobId}`,
      ],
      retryOfJobId: original._id,
      createdBy: membership.userId,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, retryId };
  },
});

export const verifyStack = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!cfg) {
      return {
        ok: false,
        setupStatus: "not_started" as const,
        checks: {
          hasConfig: false,
          hasConnectionTarget: false,
          hasAuth: false,
          connectorOnline: false,
        },
      };
    }

    const transport = cfg.transportMode ?? "direct_ws";
    const hasConnectionTarget =
      transport === "connector" ? Boolean(cfg.connectorId) : Boolean(cfg.wsUrl);
    const hasAuth = Boolean(
      (cfg.authTokenCiphertextHex && cfg.authTokenIvHex) ||
        (cfg.passwordCiphertextHex && cfg.passwordIvHex),
    );
    const connectorOnline =
      transport !== "connector" || cfg.connectorStatus === "online";
    const verified = hasConnectionTarget && hasAuth && connectorOnline;
    const nextStatus = verified ? "verified" : asSetupStatus(cfg.setupStatus);

    await ctx.db.patch(cfg._id, {
      setupStatus: nextStatus,
      updatedAt: Date.now(),
      updatedBy: membership.userId,
    });

    return {
      ok: verified,
      setupStatus: nextStatus,
      checks: {
        hasConfig: true,
        hasConnectionTarget,
        hasAuth,
        connectorOnline,
      },
    };
  },
});

export const connectorHeartbeat = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    status: v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("degraded"),
    ),
    at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // MVP: member+ can submit heartbeat; production should gate this with
    // service credentials/API key scoped to connector.
    const membership = await requireRole(ctx, args.workspaceId, "member");
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!cfg) throw new Error("OpenClaw config not found");
    if ((cfg.connectorId ?? "") !== args.connectorId.trim()) {
      throw new Error("Connector ID mismatch");
    }
    await ctx.db.patch(cfg._id, {
      connectorStatus: args.status,
      connectorLastSeenAt: args.at ?? Date.now(),
      updatedAt: Date.now(),
      updatedBy: membership.userId,
    });
    return { ok: true };
  },
});
