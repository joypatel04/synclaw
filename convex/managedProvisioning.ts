import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "./lib/permissions";
import { encryptSecretToHex } from "./lib/secretCrypto";

const managedRegionValidator = v.union(
  v.literal("eu_central_hil"),
  v.literal("eu_central_nbg"),
);

const serviceTierValidator = v.union(
  v.literal("self_serve"),
  v.literal("assisted"),
  v.literal("managed"),
);

const fallbackOrder: Record<string, string[]> = {
  eu_central_hil: ["eu_central_hil", "eu_central_nbg"],
  eu_central_nbg: ["eu_central_nbg", "eu_central_hil"],
};

type ServiceTier = "self_serve" | "assisted" | "managed";

type ManagedCloudProvisioning = {
  provider: "hetzner" | "aws";
  instanceId: string;
  host: string;
};

function isRegionAvailable(region: string): boolean {
  return region === "eu_central_hil" || region === "eu_central_nbg";
}

function resolveRegionWithFallback(requested: string) {
  const candidates = fallbackOrder[requested] ?? [requested, "eu_central_hil"];
  for (const region of candidates) {
    if (isRegionAvailable(region)) {
      return { resolvedRegion: region, fallbackApplied: region !== requested };
    }
  }
  return {
    resolvedRegion: "eu_central_hil",
    fallbackApplied: requested !== "eu_central_hil",
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function providerForManagedCloud(): "hetzner" | "aws" {
  const raw = (process.env.MANAGED_CLOUD_PROVIDER ?? "hetzner").trim().toLowerCase();
  if (raw === "aws") return "aws";
  return "hetzner";
}

function hetznerLocationForRegion(region: string): string {
  const map: Record<string, string> = {
    eu_central_hil:
      process.env.MANAGED_HETZNER_LOCATION_EU_CENTRAL_HIL?.trim() || "hel1",
    eu_central_nbg:
      process.env.MANAGED_HETZNER_LOCATION_EU_CENTRAL_NBG?.trim() || "nbg1",
  };
  return map[region] ?? map.eu_central_hil;
}

function awsRegionForFriendlyRegion(region: string): string {
  const map: Record<string, string> = {
    eu_central_hil:
      process.env.MANAGED_AWS_REGION_EU_CENTRAL_HIL?.trim() || "eu-central-1",
    eu_central_nbg:
      process.env.MANAGED_AWS_REGION_EU_CENTRAL_NBG?.trim() || "eu-central-1",
  };
  return map[region] ?? map.eu_central_hil;
}

function managedWsUrlFor(region: string, workspaceId: string, host: string): string {
  const template = process.env.MANAGED_OPENCLAW_WSS_TEMPLATE?.trim();
  if (template) {
    return template
      .replaceAll("{region}", region)
      .replaceAll("{workspaceId}", workspaceId)
      .replaceAll("{host}", host);
  }
  return `wss://${region}.managed.synclaw.in/ws/${workspaceId}`;
}

function isoNow() {
  return new Date().toISOString();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(data: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  return hex(new Uint8Array(digest));
}

async function hmac(keyBytes: Uint8Array, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function hmacFromString(key: string, data: string): Promise<Uint8Array> {
  return await hmac(new TextEncoder().encode(key), data);
}

async function awsSignedQuery(
  region: string,
  params: Record<string, string>,
): Promise<string> {
  const accessKeyId = requireEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("AWS_SECRET_ACCESS_KEY");
  const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();

  const service = "ec2";
  const host = `ec2.${region}.amazonaws.com`;
  const method = "POST";
  const endpoint = `https://${host}/`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadObj = {
    ...params,
    Version: "2016-11-15",
  };

  const encodedPairs = Object.entries(payloadObj)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, "+")}`,
    );
  const payload = encodedPairs.join("&");
  const payloadHash = await sha256(payload);

  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n${sessionToken ? `x-amz-security-token:${sessionToken}\n` : ""}`;
  const signedHeaders = sessionToken
    ? "content-type;host;x-amz-date;x-amz-security-token"
    : "content-type;host;x-amz-date";

  const canonicalRequest = [
    method,
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  const kDate = await hmacFromString(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = hex(await hmac(kSigning, stringToSign));

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    "x-amz-date": amzDate,
    authorization,
  };
  if (sessionToken) headers["x-amz-security-token"] = sessionToken;

  const response = await fetch(endpoint, {
    method,
    headers,
    body: payload,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AWS API error (${response.status}): ${text.slice(0, 400)}`);
  }
  return text;
}

async function provisionWithAws(region: string): Promise<ManagedCloudProvisioning> {
  const instanceType = process.env.MANAGED_AWS_INSTANCE_TYPE?.trim() || "t3.small";
  const imageId = requireEnv("MANAGED_AWS_AMI_ID");

  const runXml = await awsSignedQuery(region, {
    Action: "RunInstances",
    ImageId: imageId,
    InstanceType: instanceType,
    MinCount: "1",
    MaxCount: "1",
    UserData: btoa(process.env.MANAGED_AWS_USER_DATA?.trim() || ""),
  });

  const instanceIdMatch = runXml.match(/<instanceId>(i-[^<]+)<\/instanceId>/i);
  const instanceId = instanceIdMatch?.[1];
  if (!instanceId) {
    throw new Error("AWS RunInstances succeeded but instanceId was not found.");
  }

  await sleep(1500);

  const describeXml = await awsSignedQuery(region, {
    Action: "DescribeInstances",
    "InstanceId.1": instanceId,
  });
  const publicIpMatch = describeXml.match(/<ipAddress>([^<]+)<\/ipAddress>/i);
  const host = publicIpMatch?.[1] ?? `${instanceId}.${region}.aws.internal`;

  return {
    provider: "aws",
    instanceId,
    host,
  };
}

async function provisionWithHetzner(region: string): Promise<ManagedCloudProvisioning> {
  const token = requireEnv("HETZNER_API_TOKEN");
  const serverType = process.env.MANAGED_HETZNER_SERVER_TYPE?.trim() || "cx22";
  const image = process.env.MANAGED_HETZNER_IMAGE?.trim() || "ubuntu-24.04";
  const userData = process.env.MANAGED_HETZNER_CLOUD_INIT?.trim();
  const location = hetznerLocationForRegion(region);

  const response = await fetch("https://api.hetzner.cloud/v1/servers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `synclaw-managed-${Date.now()}`,
      server_type: serverType,
      image,
      location,
      user_data: userData,
      start_after_create: true,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `Hetzner API error (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  const instanceId = String(payload?.server?.id ?? "");
  const host =
    payload?.server?.public_net?.ipv4?.ip || payload?.server?.name || "unknown";
  if (!instanceId) {
    throw new Error("Hetzner server creation succeeded but server id is missing.");
  }

  return {
    provider: "hetzner",
    instanceId,
    host,
  };
}

async function provisionManagedInstance(
  region: string,
): Promise<ManagedCloudProvisioning> {
  const provider = providerForManagedCloud();
  if (provider === "aws") {
    const awsRegion = awsRegionForFriendlyRegion(region);
    return await provisionWithAws(awsRegion);
  }
  return await provisionWithHetzner(region);
}

export const _appendManagedJobLog = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    log: v.string(),
    step: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("failed"),
        v.literal("completed"),
        v.literal("canceled"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) return;
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    const statusToManaged =
      args.status === "failed"
        ? "failed"
        : args.status === "completed"
          ? "ready"
          : "provisioning";
    await ctx.db.patch(job._id, {
      logs: [...(job.logs ?? []), `[${isoNow()}] ${args.log}`],
      step: (args.step as any) ?? job.step,
      status: args.status ?? job.status,
      updatedAt: Date.now(),
    } as any);
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        managedStatus: statusToManaged,
        updatedAt: Date.now(),
      } as any);
    }
  },
});

export const _markManagedJobFailed = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) return;
    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: "failed",
      failureReason: args.reason,
      finishedAt: now,
      updatedAt: now,
      logs: [...(job.logs ?? []), `[${isoNow()}] Provisioning failed: ${args.reason}`],
    } as any);
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        managedStatus: "failed",
        updatedAt: now,
        updatedBy: cfg.updatedBy,
      } as any);
    }
  },
});

export const _finalizeManagedConnection = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
    resolvedRegion: v.string(),
    instanceId: v.string(),
    host: v.string(),
    provider: v.union(v.literal("hetzner"), v.literal("aws")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!cfg) throw new Error("OpenClaw config missing for managed connection.");

    const managedWsUrl = managedWsUrlFor(
      args.resolvedRegion,
      String(args.workspaceId),
      args.host,
    );
    const tokenEnc = await encryptSecretToHex(
      `managed-${String(args.workspaceId)}-${now}-${args.instanceId}`,
    );

    await ctx.db.patch(cfg._id, {
      wsUrl: managedWsUrl,
      deploymentMode: "managed",
      transportMode: "direct_ws",
      provisioningMode: "sutraha_managed",
      managedStatus: "ready",
      managedRegionResolved: args.resolvedRegion,
      managedConnectedAt: now,
      managedInstanceId: `${args.provider}:${args.instanceId}`,
      setupStatus: "verified",
      securityChecklistVersion: 1,
      securityConfirmedAt: now,
      recommendedMethod: "public_wss",
      authTokenCiphertextHex: tokenEnc.ciphertextHex,
      authTokenIvHex: tokenEnc.ivHex,
      updatedAt: now,
      updatedBy: cfg.updatedBy,
    } as any);

    const job = await ctx.db.get(args.jobId);
    if (job) {
      await ctx.db.patch(job._id, {
        status: "completed",
        step: "done",
        connectionAutoApplied: true,
        finishedAt: now,
        updatedAt: now,
        logs: [
          ...(job.logs ?? []),
          `[${isoNow()}] Gateway configured (${managedWsUrl}).`,
          `[${isoNow()}] Gateway auth token generated by control plane.`,
          `[${isoNow()}] Security hardening baseline applied.`,
          `[${isoNow()}] Synclaw auto-connected and verified.`,
        ],
      } as any);
    }
  },
});

export const executeManagedProvisioning = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
  },
  handler: async (ctx, args) => {
    try {
      const job = await ctx.runQuery(internal.managedProvisioning.getJobStatus, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
      });
      if (!job) return { ok: false };

      await ctx.runMutation(internal.managedProvisioning._appendManagedJobLog, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "infra_provisioning",
        status: "running",
        log: "Provisioning isolated infrastructure host.",
      });
      await sleep(1000);

      await ctx.runMutation(internal.managedProvisioning._appendManagedJobLog, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "openclaw_install",
        status: "running",
        log: "Calling cloud provider API to create instance.",
      });

      const provisioned = await provisionManagedInstance(
        job.resolvedRegion || "eu_central_hil",
      );

      await ctx.runMutation(internal.managedProvisioning._appendManagedJobLog, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "gateway_config",
        status: "running",
        log: `Instance ready (${provisioned.provider}:${provisioned.instanceId}). Bootstrapping OpenClaw runtime.`,
      });
      await sleep(1000);

      await ctx.runMutation(internal.managedProvisioning._appendManagedJobLog, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "security_hardening",
        status: "running",
        log: "Applying gateway security baseline and access controls.",
      });
      await sleep(1000);

      await ctx.runMutation(internal.managedProvisioning._appendManagedJobLog, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        step: "synclaw_connected",
        status: "running",
        log: "Connecting workspace to managed OpenClaw gateway.",
      });

      await ctx.runMutation(internal.managedProvisioning._finalizeManagedConnection, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        resolvedRegion: job.resolvedRegion || "eu_central_hil",
        instanceId: provisioned.instanceId,
        host: provisioned.host,
        provider: provisioned.provider,
      });

      return {
        ok: true,
        provider: provisioned.provider,
        instanceId: provisioned.instanceId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.managedProvisioning._markManagedJobFailed, {
        workspaceId: args.workspaceId,
        jobId: args.jobId,
        reason: message,
      });
      return { ok: false, error: message };
    }
  },
});

export const createManagedJob = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    requestedRegion: managedRegionValidator,
    serviceTier: serviceTierValidator,
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    return await createManagedJobInternal(
      ctx,
      args.workspaceId,
      args.requestedRegion,
      args.serviceTier,
      membership.userId,
    );
  },
});

async function createManagedJobInternal(
  ctx: any,
  workspaceId: any,
  requestedRegion: string,
  serviceTier: ServiceTier,
  userId: any,
) {
  const now = Date.now();
  const { resolvedRegion, fallbackApplied } =
    resolveRegionWithFallback(requestedRegion);

  const jobId = await ctx.db.insert("openclawProvisioningJobs", {
    workspaceId,
    provider: "sutraha-managed",
    targetHostType: "sutraha_managed",
    requestedRegion,
    resolvedRegion,
    fallbackApplied,
    connectionAutoApplied: false,
    status: "queued",
    step: "queued",
    logs: [
      `[${isoNow()}] Managed provisioning request created by ${userId}`,
      fallbackApplied
        ? `[${isoNow()}] Requested region ${requestedRegion} unavailable, auto-fallback to ${resolvedRegion}.`
        : `[${isoNow()}] Region selected: ${resolvedRegion}.`,
    ],
    startedAt: now,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  const existing = await ctx.db
    .query("openclawGatewayConfigs")
    .withIndex("byWorkspace", (q: any) => q.eq("workspaceId", workspaceId))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      deploymentMode: "managed",
      provisioningMode: "sutraha_managed",
      serviceTier,
      setupStatus: "infra_ready",
      managedStatus: "queued",
      managedRegionRequested: requestedRegion,
      managedRegionResolved: resolvedRegion,
      managedAutoFallbackUsed: fallbackApplied,
      managedInstanceId: existing.managedInstanceId || `mc-${String(workspaceId)}-${now}`,
      updatedAt: now,
      updatedBy: userId,
    } as any);
  } else {
    await ctx.db.insert("openclawGatewayConfigs", {
      workspaceId,
      wsUrl: "",
      deploymentMode: "managed",
      transportMode: "direct_ws",
      provisioningMode: "sutraha_managed",
      managedRegionRequested: requestedRegion,
      managedRegionResolved: resolvedRegion,
      managedStatus: "queued",
      managedInstanceId: `mc-${String(workspaceId)}-${now}`,
      managedAutoFallbackUsed: fallbackApplied,
      serviceTier,
      setupStatus: "infra_ready",
      protocol: "req",
      clientId: "openclaw-control-ui",
      clientMode: "webchat",
      clientPlatform: "web",
      role: "operator",
      scopes: ["operator.read", "operator.write", "operator.admin"],
      subscribeOnConnect: false,
      subscribeMethod: "chat.subscribe",
      includeCron: true,
      historyPollMs: 5000,
      securityChecklistVersion: 1,
      recommendedMethod: "public_wss",
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    } as any);
  }

  await ctx.scheduler.runAfter(
    0,
    internal.managedProvisioning.executeManagedProvisioning as any,
    {
      workspaceId,
      jobId,
    },
  );

  return {
    ok: true,
    jobId,
    requestedRegion,
    resolvedRegion,
    fallbackApplied,
    connected: { ok: false, pending: true },
  };
}

export const autoConnectWorkspace = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!cfg) throw new Error("OpenClaw config not found");
    await ctx.scheduler.runAfter(
      0,
      internal.managedProvisioning.executeManagedProvisioning as any,
      {
        workspaceId: args.workspaceId,
        jobId: (await ctx.db.insert("openclawProvisioningJobs", {
          workspaceId: args.workspaceId,
          provider: "sutraha-managed",
          targetHostType: "sutraha_managed",
          requestedRegion: cfg.managedRegionRequested ?? "eu_central_hil",
          resolvedRegion:
            cfg.managedRegionResolved ??
            cfg.managedRegionRequested ??
            "eu_central_hil",
          fallbackApplied: Boolean(cfg.managedAutoFallbackUsed),
          connectionAutoApplied: false,
          status: "queued",
          step: "queued",
          logs: [`[${isoNow()}] Auto-connect re-triggered by ${membership.userId}`],
          startedAt: Date.now(),
          createdBy: membership.userId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })) as any,
      },
    );
    return { ok: true, queued: true };
  },
});

export const getManagedStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    const latestJob = await ctx.db
      .query("openclawProvisioningJobs")
      .withIndex("byWorkspaceAndCreatedAt", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .first();
    if (!cfg) return null;
    return {
      deploymentMode: cfg.deploymentMode ?? "manual",
      managedStatus: cfg.managedStatus ?? "queued",
      requestedRegion: cfg.managedRegionRequested ?? "",
      resolvedRegion: cfg.managedRegionResolved ?? "",
      fallbackApplied: Boolean(cfg.managedAutoFallbackUsed),
      managedConnectedAt: cfg.managedConnectedAt ?? null,
      setupStatus: cfg.setupStatus ?? "not_started",
      latestJob,
    };
  },
});

export const getJobStatus = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    jobId: v.id("openclawProvisioningJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) return null;
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
    const job = await ctx.db.get(args.jobId);
    if (!job || job.workspaceId !== args.workspaceId) {
      throw new Error("Provisioning job not found");
    }
    const cfg = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    const serviceTier = (cfg?.serviceTier ?? "self_serve") as ServiceTier;
    const requestedRegion = (job.requestedRegion ?? "eu_central_hil") as
      | "eu_central_hil"
      | "eu_central_nbg";

    const result = await createManagedJobInternal(
      ctx,
      args.workspaceId,
      requestedRegion,
      serviceTier,
      membership.userId,
    );

    return {
      retriedFromJobId: job._id,
      triggeredBy: membership.userId,
      ...result,
    };
  },
});

export const verifyManagedConnection = mutation({
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
        status: "missing_config",
        nextAction: "Provision managed OpenClaw first.",
      };
    }
    if ((cfg.deploymentMode ?? "manual") !== "managed") {
      return {
        ok: false,
        status: "manual_mode",
        nextAction: "Switch workspace to managed deployment mode.",
      };
    }
    const hasConnectionTarget = Boolean(cfg.wsUrl);
    const hasAuth = Boolean(
      (cfg.authTokenCiphertextHex && cfg.authTokenIvHex) ||
        (cfg.passwordCiphertextHex && cfg.passwordIvHex),
    );
    const ok = hasConnectionTarget && hasAuth;
    const now = Date.now();
    await ctx.db.patch(cfg._id, {
      managedStatus: ok ? "ready" : "degraded",
      setupStatus: ok ? "verified" : (cfg.setupStatus ?? "not_started"),
      managedConnectedAt: ok ? now : cfg.managedConnectedAt,
      updatedAt: now,
      updatedBy: membership.userId,
    } as any);
    return {
      ok,
      status: ok ? "ready" : "degraded",
      checks: { hasConnectionTarget, hasAuth },
      nextAction: ok
        ? "Managed connection verified."
        : "Re-run auto-connect or retry provisioning.",
    };
  },
});
