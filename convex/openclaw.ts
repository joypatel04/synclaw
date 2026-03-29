import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireRole } from "./lib/permissions";
import { decryptSecretFromHex, encryptSecretToHex } from "./lib/secretCrypto";

const transportModeValidator = v.union(
  v.literal("direct_ws"),
  v.literal("connector"),
  v.literal("self_hosted_local"),
);
const deploymentModeValidator = v.union(
  v.literal("managed"),
  v.literal("manual"),
);
const provisioningModeValidator = v.union(
  v.literal("customer_vps"),
  v.literal("sutraha_managed"),
);
const serviceTierValidator = v.union(
  v.literal("self_serve"),
  v.literal("assisted"),
  v.literal("managed"),
);
const managedServerProfileValidator = v.union(
  v.literal("starter"),
  v.literal("standard"),
  v.literal("performance"),
);
const setupStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("infra_ready"),
  v.literal("openclaw_ready"),
  v.literal("agents_ready"),
  v.literal("verified"),
);
const recommendedMethodValidator = v.union(
  v.literal("public_wss"),
  v.literal("connector_advanced"),
  v.literal("self_hosted_local"),
);

type TransportMode = "direct_ws" | "connector" | "self_hosted_local";
type DeploymentMode = "managed" | "manual";
type ProvisioningMode = "customer_vps" | "sutraha_managed";
type ServiceTier = "self_serve" | "assisted";
type RecommendedMethod =
  | "public_wss"
  | "connector_advanced"
  | "self_hosted_local";
type SetupStatus =
  | "not_started"
  | "infra_ready"
  | "openclaw_ready"
  | "agents_ready"
  | "verified";

function normalizeScopes(scopes: string[], role?: string): string[] {
  const out = new Set(scopes.map((s) => s.trim()).filter(Boolean));

  if (out.size === 0) {
    out.add("operator.read");
    out.add("operator.write");
  }

  // Newer OpenClaw gateway versions may require admin scope for operator flows.
  if ((role ?? "operator") === "operator") {
    out.add("operator.admin");
  }

  return Array.from(out);
}

function validateWsUrl(input: string): string {
  const wsUrl = input.trim();
  if (!wsUrl) throw new Error("wsUrl is required");
  if (!/^wss?:\/\//i.test(wsUrl)) {
    throw new Error('wsUrl must start with "ws://" or "wss://"');
  }
  return wsUrl;
}

function normalizeTransportMode(input?: string): TransportMode {
  if (input === "connector" || input === "self_hosted_local") return input;
  return "direct_ws";
}

function normalizeDeploymentMode(input?: string): DeploymentMode {
  if (input === "managed") return "managed";
  return "manual";
}

function normalizeProvisioningMode(input?: string): ProvisioningMode {
  if (input === "sutraha_managed") return input;
  return "sutraha_managed";
}

function normalizeServiceTier(input?: string): ServiceTier {
  if (input === "assisted") return input;
  return "self_serve";
}

function normalizeSetupStatus(input?: string): SetupStatus {
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

function validateHttpUrl(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) {
    throw new Error(
      'filesBridgeBaseUrl must start with "http://" or "https://"',
    );
  }
  return value.replace(/\/+$/, "");
}

function inferRecommendedMethod(
  wsUrl: string,
  transportMode: TransportMode,
): RecommendedMethod {
  if (transportMode === "self_hosted_local") return "self_hosted_local";
  const value = wsUrl.trim().toLowerCase();
  if (
    value.startsWith("ws://") ||
    value.includes("localhost") ||
    value.includes("127.0.0.1") ||
    value.includes("100.")
  ) {
    return "connector_advanced";
  }
  return "public_wss";
}

function validatePublicWssConfigFromRow(row: any | null) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nextActions: string[] = [];

  if (!row) {
    return {
      ok: false,
      errors: ["OpenClaw configuration not found for this workspace."],
      warnings,
      nextActions: [
        "Set a public wss:// OpenClaw gateway URL and credentials in Settings > OpenClaw.",
      ],
      riskLevel: "high" as const,
    };
  }

  const transportMode = normalizeTransportMode(row.transportMode);
  const wsUrl = (row.wsUrl ?? "").trim();
  const scopes = normalizeScopes(row.scopes ?? [], row.role ?? "operator");
  const hasToken = Boolean(row.authTokenCiphertextHex && row.authTokenIvHex);
  const hasPassword = Boolean(row.passwordCiphertextHex && row.passwordIvHex);

  if (transportMode !== "direct_ws") {
    warnings.push(
      "Public WSS validation is most relevant when Connection Method is Public WSS.",
    );
    nextActions.push("Switch Connection Method to Public WSS for this checklist.");
  }

  if (!wsUrl) {
    errors.push("Missing WebSocket URL.");
    nextActions.push("Set wsUrl to your public OpenClaw endpoint.");
  } else if (!/^wss:\/\//i.test(wsUrl)) {
    errors.push('Public WSS mode requires a URL starting with "wss://".');
    nextActions.push("Use a TLS-terminated gateway URL (wss://...).");
  }

  if (!hasToken && !hasPassword) {
    errors.push("Missing credentials: provide an auth token or a password.");
    nextActions.push("Set token/password in the Secrets section before testing.");
  }

  if (!row.role?.trim()) {
    errors.push("Missing role.");
    nextActions.push("Set role to operator (or another valid role).");
  }

  if (scopes.length === 0) {
    errors.push("No scopes configured.");
    nextActions.push(
      "Use minimum scopes: operator.read, operator.write, operator.admin.",
    );
  } else if ((row.role ?? "operator") === "operator") {
    for (const requiredScope of [
      "operator.read",
      "operator.write",
      "operator.admin",
    ]) {
      if (!scopes.includes(requiredScope)) {
        errors.push(`Missing required scope: ${requiredScope}.`);
      }
    }
  }

  if (!row.securityConfirmedAt) {
    warnings.push("Security checklist is not confirmed yet.");
    nextActions.push("Confirm Public WSS security checklist after hardening.");
  }

  if (errors.length === 0) {
    nextActions.push("Run Test to verify pairing and handshake are healthy.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    nextActions,
    riskLevel:
      errors.length > 0 ? ("high" as const) : warnings.length > 0 ? ("medium" as const) : ("low" as const),
  };
}

export const getConfigSummary = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const row = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!row) return null;

    return {
      deploymentMode: normalizeDeploymentMode(row.deploymentMode),
      transportMode: normalizeTransportMode(row.transportMode),
      provisioningMode: normalizeProvisioningMode(row.provisioningMode),
      managedRegionRequested: row.managedRegionRequested ?? "",
      managedRegionResolved: row.managedRegionResolved ?? "",
      managedServerProfile: row.managedServerProfile ?? "starter",
      managedServerType: row.managedServerType ?? "",
      managedUpstreamHost: row.managedUpstreamHost ?? "",
      managedUpstreamPort: row.managedUpstreamPort ?? null,
      managedRouteVersion: row.managedRouteVersion ?? null,
      managedStatus: row.managedStatus ?? "queued",
      managedInstanceId: row.managedInstanceId ?? "",
      managedConnectedAt: row.managedConnectedAt ?? null,
      managedBootstrapReadyAt: row.managedBootstrapReadyAt ?? null,
      managedGatewayReadyAt: row.managedGatewayReadyAt ?? null,
      managedAutoFallbackUsed: Boolean(row.managedAutoFallbackUsed),
      serviceTier: normalizeServiceTier(row.serviceTier),
      setupStatus: normalizeSetupStatus(row.setupStatus),
      ownerContact: row.ownerContact ?? "",
      supportNotes: row.supportNotes ?? "",
      connectorId: row.connectorId ?? "",
      connectorStatus: row.connectorStatus ?? "offline",
      connectorLastSeenAt: row.connectorLastSeenAt ?? null,
      securityChecklistVersion: row.securityChecklistVersion ?? null,
      securityConfirmedAt: row.securityConfirmedAt ?? null,
      publicWssHardeningNotes: row.publicWssHardeningNotes ?? "",
      recommendedMethod:
        row.recommendedMethod ??
        inferRecommendedMethod(row.wsUrl, normalizeTransportMode(row.transportMode)),
      wsUrl: row.wsUrl,
      protocol: row.protocol,
      clientId: row.clientId,
      clientMode: row.clientMode,
      clientPlatform: row.clientPlatform,
      role: row.role,
      scopes: normalizeScopes(row.scopes, row.role),
      subscribeOnConnect: row.subscribeOnConnect,
      subscribeMethod: row.subscribeMethod,
      includeCron: row.includeCron,
      historyPollMs: row.historyPollMs,
      filesBridgeEnabled: Boolean(row.filesBridgeEnabled),
      filesBridgeBaseUrl: row.filesBridgeBaseUrl ?? "",
      filesBridgeRootPath: row.filesBridgeRootPath ?? "",
      hasFilesBridgeToken: Boolean(
        row.filesBridgeTokenCiphertextHex && row.filesBridgeTokenIvHex,
      ),
      hasAuthToken: Boolean(row.authTokenCiphertextHex && row.authTokenIvHex),
      hasPassword: Boolean(row.passwordCiphertextHex && row.passwordIvHex),
      updatedAt: row.updatedAt,
    };
  },
});

export const getClientConfig = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Member+ can use chat (direct WS) because the token will be exposed in the
    // browser connection. Viewers should not be able to fetch it.
    await requireRole(ctx, args.workspaceId, "member");

    const row = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!row) return null;

    const authToken =
      row.authTokenCiphertextHex && row.authTokenIvHex
        ? await decryptSecretFromHex(
            row.authTokenCiphertextHex,
            row.authTokenIvHex,
          )
        : undefined;

    const password =
      row.passwordCiphertextHex && row.passwordIvHex
        ? await decryptSecretFromHex(
            row.passwordCiphertextHex,
            row.passwordIvHex,
          )
        : undefined;

    return {
      deploymentMode: normalizeDeploymentMode(row.deploymentMode),
      transportMode: normalizeTransportMode(row.transportMode),
      provisioningMode: normalizeProvisioningMode(row.provisioningMode),
      managedRegionRequested: row.managedRegionRequested ?? "",
      managedRegionResolved: row.managedRegionResolved ?? "",
      managedServerProfile: row.managedServerProfile ?? "starter",
      managedServerType: row.managedServerType ?? "",
      managedUpstreamHost: row.managedUpstreamHost ?? "",
      managedUpstreamPort: row.managedUpstreamPort ?? null,
      managedRouteVersion: row.managedRouteVersion ?? null,
      managedStatus: row.managedStatus ?? "queued",
      managedInstanceId: row.managedInstanceId ?? "",
      managedConnectedAt: row.managedConnectedAt ?? null,
      managedBootstrapReadyAt: row.managedBootstrapReadyAt ?? null,
      managedGatewayReadyAt: row.managedGatewayReadyAt ?? null,
      managedAutoFallbackUsed: Boolean(row.managedAutoFallbackUsed),
      serviceTier: normalizeServiceTier(row.serviceTier),
      setupStatus: normalizeSetupStatus(row.setupStatus),
      ownerContact: row.ownerContact ?? "",
      supportNotes: row.supportNotes ?? "",
      connectorId: row.connectorId ?? "",
      connectorStatus: row.connectorStatus ?? "offline",
      connectorLastSeenAt: row.connectorLastSeenAt ?? null,
      securityChecklistVersion: row.securityChecklistVersion ?? null,
      securityConfirmedAt: row.securityConfirmedAt ?? null,
      publicWssHardeningNotes: row.publicWssHardeningNotes ?? "",
      recommendedMethod:
        row.recommendedMethod ??
        inferRecommendedMethod(row.wsUrl, normalizeTransportMode(row.transportMode)),
      wsUrl: row.wsUrl,
      protocol: row.protocol,
      authToken,
      password,
      clientId: row.clientId,
      clientMode: row.clientMode,
      clientPlatform: row.clientPlatform,
      role: row.role,
      scopes: normalizeScopes(row.scopes, row.role),
      subscribeOnConnect: row.subscribeOnConnect,
      subscribeMethod: row.subscribeMethod,
      includeCron: row.includeCron,
      historyPollMs: row.historyPollMs,
      filesBridgeEnabled: Boolean(row.filesBridgeEnabled),
      filesBridgeBaseUrl: row.filesBridgeBaseUrl ?? "",
      filesBridgeRootPath: row.filesBridgeRootPath ?? "",
    };
  },
});

export const upsertConfig = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    wsUrl: v.string(),
    deploymentMode: v.optional(deploymentModeValidator),
    transportMode: v.optional(transportModeValidator),
    provisioningMode: v.optional(provisioningModeValidator),
    managedRegionRequested: v.optional(v.string()),
    managedRegionResolved: v.optional(v.string()),
    managedServerProfile: v.optional(managedServerProfileValidator),
    managedServerType: v.optional(v.string()),
    managedUpstreamHost: v.optional(v.string()),
    managedUpstreamPort: v.optional(v.union(v.number(), v.null())),
    managedRouteVersion: v.optional(v.union(v.number(), v.null())),
    managedStatus: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("provisioning"),
        v.literal("ready"),
        v.literal("degraded"),
        v.literal("failed"),
      ),
    ),
    managedInstanceId: v.optional(v.string()),
    managedConnectedAt: v.optional(v.union(v.number(), v.null())),
    managedBootstrapReadyAt: v.optional(v.union(v.number(), v.null())),
    managedGatewayReadyAt: v.optional(v.union(v.number(), v.null())),
    managedAutoFallbackUsed: v.optional(v.boolean()),
    serviceTier: v.optional(serviceTierValidator),
    setupStatus: v.optional(setupStatusValidator),
    ownerContact: v.optional(v.string()),
    supportNotes: v.optional(v.string()),
    connectorId: v.optional(v.string()),
    connectorStatus: v.optional(
      v.union(v.literal("online"), v.literal("offline"), v.literal("degraded")),
    ),
    connectorLastSeenAt: v.optional(v.union(v.number(), v.null())),
    securityChecklistVersion: v.optional(v.number()),
    securityConfirmedAt: v.optional(v.union(v.number(), v.null())),
    publicWssHardeningNotes: v.optional(v.string()),
    recommendedMethod: v.optional(recommendedMethodValidator),
    protocol: v.union(v.literal("req"), v.literal("jsonrpc")),
    clientId: v.string(),
    clientMode: v.string(),
    clientPlatform: v.string(),
    role: v.string(),
    scopes: v.array(v.string()),
    subscribeOnConnect: v.boolean(),
    subscribeMethod: v.string(),
    includeCron: v.boolean(),
    historyPollMs: v.number(),
    filesBridgeEnabled: v.optional(v.boolean()),
    filesBridgeBaseUrl: v.optional(v.string()),
    filesBridgeRootPath: v.optional(v.string()),
    filesBridgeToken: v.optional(v.union(v.string(), v.null())),
    authToken: v.optional(v.union(v.string(), v.null())),
    password: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "owner");

    const now = Date.now();
    const deploymentMode = normalizeDeploymentMode(args.deploymentMode);
    const transportMode = normalizeTransportMode(args.transportMode);
    const provisioningMode = normalizeProvisioningMode(args.provisioningMode);
    const serviceTier = normalizeServiceTier(args.serviceTier);
    const setupStatus = normalizeSetupStatus(args.setupStatus);
    const wsUrlRaw = args.wsUrl.trim();
    const wsUrl =
      transportMode === "connector" ? wsUrlRaw : validateWsUrl(args.wsUrl);
    if (
      transportMode === "connector" &&
      args.connectorId !== undefined &&
      !args.connectorId.trim()
    ) {
      throw new Error("connectorId is required for connector transport mode");
    }
    const scopes = normalizeScopes(args.scopes, args.role);

    const existing = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    // Handle secrets: undefined = keep, null = clear, string = replace.
    const secretPatch: Record<string, string | undefined | null> = {};

    if (args.authToken !== undefined) {
      if (args.authToken === null || args.authToken.trim() === "") {
        secretPatch.authTokenCiphertextHex = undefined;
        secretPatch.authTokenIvHex = undefined;
      } else {
        const enc = await encryptSecretToHex(args.authToken);
        secretPatch.authTokenCiphertextHex = enc.ciphertextHex;
        secretPatch.authTokenIvHex = enc.ivHex;
      }
    }

    if (args.password !== undefined) {
      if (args.password === null || args.password.trim() === "") {
        secretPatch.passwordCiphertextHex = undefined;
        secretPatch.passwordIvHex = undefined;
      } else {
        const enc = await encryptSecretToHex(args.password);
        secretPatch.passwordCiphertextHex = enc.ciphertextHex;
        secretPatch.passwordIvHex = enc.ivHex;
      }
    }

    if (args.filesBridgeToken !== undefined) {
      if (
        args.filesBridgeToken === null ||
        args.filesBridgeToken.trim() === ""
      ) {
        secretPatch.filesBridgeTokenCiphertextHex = undefined;
        secretPatch.filesBridgeTokenIvHex = undefined;
      } else {
        const enc = await encryptSecretToHex(args.filesBridgeToken);
        secretPatch.filesBridgeTokenCiphertextHex = enc.ciphertextHex;
        secretPatch.filesBridgeTokenIvHex = enc.ivHex;
      }
    }

    const nextFilesBridgeEnabled =
      args.filesBridgeEnabled ?? existing?.filesBridgeEnabled ?? false;
    const nextFilesBridgeBaseUrl =
      args.filesBridgeBaseUrl !== undefined
        ? validateHttpUrl(args.filesBridgeBaseUrl)
        : (existing?.filesBridgeBaseUrl ?? "");
    const nextFilesBridgeRootPath =
      args.filesBridgeRootPath !== undefined
        ? (args.filesBridgeRootPath ?? "").trim()
        : (existing?.filesBridgeRootPath ?? "");
    const recommendedMethod =
      args.recommendedMethod ??
      existing?.recommendedMethod ??
      inferRecommendedMethod(wsUrl, transportMode);
    const nextSecurityChecklistVersion =
      args.securityChecklistVersion ?? existing?.securityChecklistVersion ?? 1;
    const nextSecurityConfirmedAt =
      args.securityConfirmedAt === null
        ? undefined
        : (args.securityConfirmedAt ?? existing?.securityConfirmedAt ?? undefined);

    const base = {
      workspaceId: args.workspaceId,
      wsUrl,
      deploymentMode,
      transportMode,
      provisioningMode,
      managedRegionRequested:
        args.managedRegionRequested !== undefined
          ? args.managedRegionRequested.trim()
          : (existing?.managedRegionRequested ?? ""),
      managedRegionResolved:
        args.managedRegionResolved !== undefined
          ? args.managedRegionResolved.trim()
          : (existing?.managedRegionResolved ?? ""),
      managedServerProfile:
        args.managedServerProfile ?? existing?.managedServerProfile ?? "starter",
      managedServerType:
        args.managedServerType !== undefined
          ? args.managedServerType.trim()
          : (existing?.managedServerType ?? ""),
      managedUpstreamHost:
        args.managedUpstreamHost !== undefined
          ? args.managedUpstreamHost.trim()
          : (existing?.managedUpstreamHost ?? ""),
      managedUpstreamPort:
        args.managedUpstreamPort === null
          ? undefined
          : (args.managedUpstreamPort ??
            existing?.managedUpstreamPort ??
            undefined),
      managedRouteVersion:
        args.managedRouteVersion === null
          ? undefined
          : (args.managedRouteVersion ??
            existing?.managedRouteVersion ??
            undefined),
      managedStatus:
        args.managedStatus ?? existing?.managedStatus ?? "queued",
      managedInstanceId:
        args.managedInstanceId !== undefined
          ? args.managedInstanceId.trim()
          : (existing?.managedInstanceId ?? ""),
      managedConnectedAt:
        args.managedConnectedAt === null
          ? undefined
          : (args.managedConnectedAt ??
            existing?.managedConnectedAt ??
            undefined),
      managedBootstrapReadyAt:
        args.managedBootstrapReadyAt === null
          ? undefined
          : (args.managedBootstrapReadyAt ??
            existing?.managedBootstrapReadyAt ??
            undefined),
      managedGatewayReadyAt:
        args.managedGatewayReadyAt === null
          ? undefined
          : (args.managedGatewayReadyAt ??
            existing?.managedGatewayReadyAt ??
            undefined),
      managedAutoFallbackUsed:
        args.managedAutoFallbackUsed ??
        existing?.managedAutoFallbackUsed ??
        false,
      serviceTier,
      setupStatus,
      ownerContact:
        args.ownerContact !== undefined
          ? args.ownerContact.trim()
          : (existing?.ownerContact ?? ""),
      supportNotes:
        args.supportNotes !== undefined
          ? args.supportNotes.trim()
          : (existing?.supportNotes ?? ""),
      connectorId:
        args.connectorId !== undefined
          ? args.connectorId.trim()
          : (existing?.connectorId ?? ""),
      connectorStatus:
        args.connectorStatus ?? existing?.connectorStatus ?? "offline",
      connectorLastSeenAt:
        args.connectorLastSeenAt === null
          ? undefined
          : (args.connectorLastSeenAt ??
            existing?.connectorLastSeenAt ??
            undefined),
      securityChecklistVersion: nextSecurityChecklistVersion,
      securityConfirmedAt: nextSecurityConfirmedAt,
      publicWssHardeningNotes:
        args.publicWssHardeningNotes !== undefined
          ? args.publicWssHardeningNotes.trim()
          : (existing?.publicWssHardeningNotes ?? ""),
      recommendedMethod,
      protocol: args.protocol,
      clientId: args.clientId || "openclaw-control-ui",
      clientMode: args.clientMode || "webchat",
      clientPlatform: args.clientPlatform || "web",
      role: args.role || "operator",
      scopes,
      subscribeOnConnect: args.subscribeOnConnect,
      subscribeMethod: args.subscribeMethod || "chat.subscribe",
      includeCron: args.includeCron,
      historyPollMs: Math.max(0, Math.floor(args.historyPollMs)),
      filesBridgeEnabled: nextFilesBridgeEnabled,
      filesBridgeBaseUrl: nextFilesBridgeBaseUrl,
      filesBridgeRootPath: nextFilesBridgeRootPath,
      updatedAt: now,
      updatedBy: membership.userId,
    };

    if (!existing) {
      const doc = {
        ...base,
        createdAt: now,
        ...secretPatch,
      };
      await ctx.db.insert("openclawGatewayConfigs", doc as any);
      return { ok: true };
    }

    // Convex `patch` supports deleting optional fields by setting them to
    // `undefined`, which we use for the "clear token/password" behavior.
    await ctx.db.patch(existing._id, {
      ...base,
      ...secretPatch,
    } as any);

    return { ok: true };
  },
});

export const validatePublicWssConfig = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const row = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    return validatePublicWssConfigFromRow(row);
  },
});

export const getSecurityStatus = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const row = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    const validation = validatePublicWssConfigFromRow(row);
    const status =
      validation.errors.length > 0
        ? "invalid_config"
        : validation.warnings.length > 0
          ? "needs_hardening"
          : "secure";
    return {
      status,
      validation,
      securityChecklistVersion: row?.securityChecklistVersion ?? null,
      securityConfirmedAt: row?.securityConfirmedAt ?? null,
      publicWssHardeningNotes: row?.publicWssHardeningNotes ?? "",
      recommendedMethod: row
        ? (row.recommendedMethod ??
          inferRecommendedMethod(row.wsUrl, normalizeTransportMode(row.transportMode)))
        : ("public_wss" as const),
    };
  },
});

export const confirmSecurityChecklist = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    checklistAck: v.object({
      allowedOrigins: v.boolean(),
      deviceApproval: v.boolean(),
      minimalScopes: v.boolean(),
      testPass: v.boolean(),
      dashboardProtection: v.boolean(),
    }),
    hardeningNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "owner");
    const row = await ctx.db
      .query("openclawGatewayConfigs")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
    if (!row) {
      throw new Error("OpenClaw configuration not found.");
    }
    const allConfirmed = Object.values(args.checklistAck).every(Boolean);
    if (!allConfirmed) {
      throw new Error(
        "Complete all Public WSS checklist acknowledgements before confirming.",
      );
    }
    const confirmedAt = Date.now();
    await ctx.db.patch(row._id, {
      securityChecklistVersion: 1,
      securityConfirmedAt: confirmedAt,
      publicWssHardeningNotes:
        args.hardeningNotes !== undefined
          ? args.hardeningNotes.trim()
          : (row.publicWssHardeningNotes ?? ""),
      recommendedMethod:
        row.recommendedMethod ??
        inferRecommendedMethod(row.wsUrl, normalizeTransportMode(row.transportMode)),
      updatedAt: confirmedAt,
    } as any);
    return { ok: true, securityConfirmedAt: confirmedAt };
  },
});
