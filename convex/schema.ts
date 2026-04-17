import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const workspaceRole = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer"),
);

const webhookActionTemplate = v.union(
  v.literal("create_task"),
  v.literal("create_document"),
  v.literal("log_activity"),
  v.literal("task_and_nudge_main"),
);

export default defineSchema({
  // Override authTables.users to accept null email/name from OAuth providers.
  // GitHub returns email:null when the user's email is private.
  // v.optional(v.string()) rejects null; we need v.union to allow it.
  ...authTables,
  users: defineTable({
    name: v.optional(v.union(v.string(), v.null())),
    image: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.union(v.string(), v.null())),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // ─── Workspace tables ───────────────────────────────────────────

  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
    plan: v.optional(
      v.union(v.literal("free"), v.literal("starter"), v.literal("pro")),
    ),
    billingStatus: v.optional(
      v.union(
        v.literal("trialing"),
        v.literal("active"),
        v.literal("past_due"),
        v.literal("canceled"),
        v.literal("incomplete"),
      ),
    ),
    providerCustomerId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    billingCurrency: v.optional(v.union(v.literal("INR"), v.literal("USD"))),
    graceEndsAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
  })
    .index("bySlug", ["slug"])
    .index("byProviderCustomerId", ["providerCustomerId"])
    .index("byProviderSubscriptionId", ["providerSubscriptionId"]),

  razorpayEvents: defineTable({
    workspaceId: v.id("workspaces"),
    eventType: v.string(),
    providerEventId: v.string(),
    payloadDigest: v.string(),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byProviderEventId", ["providerEventId"]),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role: workspaceRole,
    joinedAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byUser", ["userId"])
    .index("byWorkspaceAndUser", ["workspaceId", "userId"]),

  workspaceInvites: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    invitedBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
    ),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byEmail", ["email"])
    .index("byCreatedAt", ["createdAt"]),

  workspaceWebhooks: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    enabled: v.boolean(),
    secretHash: v.string(),
    eventFilter: v.array(v.string()),
    actionTemplate: webhookActionTemplate,
    mappingConfig: v.object({
      titlePath: v.optional(v.string()),
      bodyPath: v.optional(v.string()),
      priority: v.optional(
        v.union(
          v.literal("high"),
          v.literal("medium"),
          v.literal("low"),
          v.literal("none"),
        ),
      ),
      status: v.optional(
        v.union(
          v.literal("inbox"),
          v.literal("assigned"),
          v.literal("in_progress"),
          v.literal("review"),
          v.literal("done"),
          v.literal("blocked"),
        ),
      ),
    }),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndEnabled", ["workspaceId", "enabled"])
    .index("byWorkspaceAndName", ["workspaceId", "name"]),

  webhookPayloads: defineTable({
    workspaceId: v.id("workspaces"),
    webhookId: v.id("workspaceWebhooks"),
    providerEventId: v.optional(v.string()),
    headers: v.any(),
    payload: v.any(),
    contentType: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("ignored"),
    ),
    errorMessage: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    actionResult: v.optional(v.any()),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byWebhook", ["webhookId"])
    .index("byWebhookAndReceivedAt", ["webhookId", "receivedAt"])
    .index("byWorkspaceAndStatus", ["workspaceId", "status"])
    .index("byWebhookAndProviderEventId", ["webhookId", "providerEventId"])
    .index("byReceivedAt", ["receivedAt"]),

  // ─── API Keys (server-to-server auth for OpenClaw etc.) ────────

  workspaceApiKeys: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    keyPrefix: v.string(),
    keyHash: v.string(),
    role: workspaceRole,
    botUserId: v.id("users"),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byKeyHash", ["keyHash"]),

  // ─── OpenClaw Gateway Config (workspace-scoped) ─────────────────
  //
  // Stores OpenClaw Gateway connection settings per workspace.
  // NOTE: authToken/password are encrypted at rest in Convex.
  openclawGatewayConfigs: defineTable({
    workspaceId: v.id("workspaces"),
    wsUrl: v.string(),
    deploymentMode: v.optional(v.union(v.literal("managed"), v.literal("manual"))),
    transportMode: v.optional(
      v.union(
        v.literal("direct_ws"),
        v.literal("connector"),
        v.literal("self_hosted_local"),
      ),
    ),
    connectorId: v.optional(v.string()),
    connectorStatus: v.optional(
      v.union(v.literal("online"), v.literal("offline"), v.literal("degraded")),
    ),
    connectorLastSeenAt: v.optional(v.number()),
    securityChecklistVersion: v.optional(v.number()),
    securityConfirmedAt: v.optional(v.number()),
    publicWssHardeningNotes: v.optional(v.string()),
    recommendedMethod: v.optional(
      v.union(
        v.literal("public_wss"),
        v.literal("connector_advanced"),
        v.literal("self_hosted_local"),
      ),
    ),
    provisioningMode: v.optional(
      v.union(v.literal("customer_vps"), v.literal("synclaw_managed")),
    ),
    managedRegionRequested: v.optional(v.string()),
    managedRegionResolved: v.optional(v.string()),
    managedServerProfile: v.optional(
      v.union(
        v.literal("starter"),
        v.literal("standard"),
        v.literal("performance"),
      ),
    ),
    managedServerType: v.optional(v.string()),
    managedUpstreamHost: v.optional(v.string()),
    managedUpstreamPort: v.optional(v.number()),
    managedRouteVersion: v.optional(v.number()),
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
    managedConnectedAt: v.optional(v.number()),
    managedBootstrapReadyAt: v.optional(v.number()),
    managedGatewayReadyAt: v.optional(v.number()),
    providerRuntimeStatus: v.optional(
      v.union(v.literal("pending"), v.literal("ready"), v.literal("failed")),
    ),
    defaultProvider: v.optional(
      v.union(v.literal("openai"), v.literal("anthropic"), v.literal("gemini")),
    ),
    defaultModel: v.optional(v.string()),
    lastProviderApplyAt: v.optional(v.number()),
    lastProviderApplyError: v.optional(v.string()),
    managedAutoFallbackUsed: v.optional(v.boolean()),
    serviceTier: v.optional(
      v.union(
        v.literal("self_serve"),
        v.literal("assisted"),
        v.literal("managed"),
      ),
    ),
    setupStatus: v.optional(
      v.union(
        v.literal("not_started"),
        v.literal("infra_ready"),
        v.literal("openclaw_ready"),
        v.literal("agents_ready"),
        v.literal("verified"),
      ),
    ),
    ownerContact: v.optional(v.string()),
    supportNotes: v.optional(v.string()),
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
    authTokenCiphertextHex: v.optional(v.string()),
    authTokenIvHex: v.optional(v.string()),
    passwordCiphertextHex: v.optional(v.string()),
    passwordIvHex: v.optional(v.string()),
    filesBridgeEnabled: v.optional(v.boolean()),
    filesBridgeBaseUrl: v.optional(v.string()),
    filesBridgeRootPath: v.optional(v.string()),
    filesBridgeTokenCiphertextHex: v.optional(v.string()),
    filesBridgeTokenIvHex: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("byWorkspace", ["workspaceId"]),

  // ─── OpenClaw provisioning jobs (workspace-scoped) ─────────────
  openclawProvisioningJobs: defineTable({
    workspaceId: v.id("workspaces"),
    provider: v.string(),
    targetHostType: v.union(
      v.literal("customer_vps"),
      v.literal("synclaw_managed"),
    ),
    requestedRegion: v.optional(v.string()),
    requestedServerProfile: v.optional(
      v.union(
        v.literal("starter"),
        v.literal("standard"),
        v.literal("performance"),
      ),
    ),
    requestedServerType: v.optional(v.string()),
    resolvedServerType: v.optional(v.string()),
    resolvedRegion: v.optional(v.string()),
    fallbackApplied: v.optional(v.boolean()),
    bootstrapStatus: v.optional(
      v.union(v.literal("pending"), v.literal("running"), v.literal("ready"), v.literal("failed")),
    ),
    gatewayRouteStatus: v.optional(
      v.union(v.literal("pending"), v.literal("running"), v.literal("ready"), v.literal("failed")),
    ),
    healthcheckStatus: v.optional(
      v.union(v.literal("pending"), v.literal("running"), v.literal("ready"), v.literal("failed")),
    ),
    connectionAutoApplied: v.optional(v.boolean()),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("failed"),
      v.literal("completed"),
      v.literal("canceled"),
    ),
    step: v.union(
      v.literal("queued"),
      v.literal("infra_provisioning"),
      v.literal("host_placement"),
      v.literal("bootstrap_openclaw"),
      v.literal("tenant_runtime_create"),
      v.literal("gateway_route_config"),
      v.literal("tenant_route_config"),
      v.literal("health_verification"),
      v.literal("tenant_health_verification"),
      v.literal("openclaw_install"),
      v.literal("gateway_config"),
      v.literal("security_hardening"),
      v.literal("synclaw_connected"),
      v.literal("agent_bootstrap"),
      v.literal("verification"),
      v.literal("done"),
    ),
    logs: v.array(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    failureCode: v.optional(
      v.union(
        v.literal("PROVISION_FAILED"),
        v.literal("BOOTSTRAP_FAILED"),
        v.literal("GATEWAY_ROUTE_FAILED"),
        v.literal("HEALTHCHECK_FAILED"),
        v.literal("CONNECTIVITY_FAILED"),
      ),
    ),
    failureReason: v.optional(v.string()),
    retryOfJobId: v.optional(v.id("openclawProvisioningJobs")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndCreatedAt", ["workspaceId", "createdAt"])
    .index("byWorkspaceAndStatus", ["workspaceId", "status"]),

  // ─── Managed host pool (commercial managed runtime) ────────────
  managedHosts: defineTable({
    hostId: v.string(),
    provider: v.string(),
    region: v.string(),
    apiBaseUrl: v.optional(v.string()),
    publicIp: v.optional(v.string()),
    privateIp: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("degraded"),
      v.literal("draining"),
      v.literal("offline"),
    ),
    capacityCpu: v.number(),
    capacityMemMb: v.number(),
    usedCpu: v.optional(v.number()),
    usedMemMb: v.optional(v.number()),
    agentVersion: v.optional(v.string()),
    lastHeartbeatAt: v.number(),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byHostId", ["hostId"])
    .index("byStatusAndRegion", ["status", "region"])
    .index("byUpdatedAt", ["updatedAt"]),

  // ─── Managed workspace runtime placement (commercial managed runtime) ──
  managedWorkspaceRuntimes: defineTable({
    workspaceId: v.id("workspaces"),
    hostId: v.string(),
    runtimeId: v.optional(v.string()),
    runtimeStatus: v.union(
      v.literal("creating"),
      v.literal("ready"),
      v.literal("degraded"),
      v.literal("failed"),
      v.literal("deleted"),
    ),
    openclawContainerId: v.optional(v.string()),
    fsBridgeContainerId: v.optional(v.string()),
    upstreamHost: v.string(),
    upstreamPort: v.number(),
    fsBridgeBaseUrl: v.optional(v.string()),
    volumeName: v.optional(v.string()),
    resourceProfile: v.optional(v.string()),
    lastHealthAt: v.optional(v.number()),
    failureCode: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byHostId", ["hostId"])
    .index("byRuntimeStatus", ["runtimeStatus"]),

  // ─── Assisted setup sessions (workspace-scoped) ────────────────
  openclawSupportSessions: defineTable({
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("assisted_launch")),
    status: v.union(
      v.literal("requested"),
      v.literal("scheduled"),
      v.literal("completed"),
      v.literal("canceled"),
    ),
    ownerContact: v.string(),
    notes: v.optional(v.string()),
    preferredTime: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndCreatedAt", ["workspaceId", "createdAt"]),

  // ─── Workspace model provider keys (encrypted at rest) ─────────
  workspaceModelProviderKeys: defineTable({
    workspaceId: v.id("workspaces"),
    provider: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("gemini"),
      v.literal("google_antigravity"),
      v.literal("z_ai"),
      v.literal("minimax"),
    ),
    label: v.optional(v.string()),
    keyCiphertextHex: v.string(),
    keyIvHex: v.string(),
    status: v.union(
      v.literal("untested"),
      v.literal("valid"),
      v.literal("invalid"),
    ),
    lastAppliedAt: v.optional(v.number()),
    lastAppliedStatus: v.optional(
      v.union(v.literal("pending"), v.literal("applied"), v.literal("failed")),
    ),
    lastAppliedError: v.optional(v.string()),
    lastRuntimeValidatedAt: v.optional(v.number()),
    lastRuntimeValidationStatus: v.optional(
      v.union(v.literal("valid"), v.literal("invalid")),
    ),
    lastValidatedAt: v.optional(v.number()),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byWorkspaceAndProvider", ["workspaceId", "provider"]),

  // ─── Domain tables (all workspace-scoped) ───────────────────────

  agents: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    role: v.string(),
    emoji: v.string(),
    sessionKey: v.string(),
    workspaceFolderPath: v.optional(v.string()),
    externalAgentId: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
    status: v.union(
      v.literal("idle"),
      v.literal("active"),
      v.literal("error"),
      v.literal("offline"),
    ),
    currentTaskId: v.union(v.id("tasks"), v.null()),
    lastHeartbeat: v.number(),
    lastPulseAt: v.optional(v.number()),
    telemetry: v.optional(
      v.object({
        currentModel: v.string(),
        openclawVersion: v.string(),
        lastRunDurationMs: v.number(),
        // Legacy fields — present in existing documents, no longer written by new code.
        totalTokensUsed: v.optional(v.float64()),
        lastRunCost: v.optional(v.float64()),
      }),
    ),
    lastSeenActivityAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byStatus", ["status"])
    .index("bySessionKey", ["sessionKey"])
    .index("byWorkspaceAndSessionKey", ["workspaceId", "sessionKey"]),

  // ─── Agent setup progress (workspace-scoped, owner-managed) ────
  agentSetupProgress: defineTable({
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    setupVersion: v.optional(v.number()),
    bootstrapPrimedAt: v.optional(v.number()),
    heartbeatConfirmedAt: v.optional(v.number()),
    cronConfirmedAt: v.optional(v.number()),
    protocolConfirmedAt: v.optional(v.number()),
    localFilesWrittenAt: v.optional(v.number()),
    requiredFilesConfirmedAt: v.optional(v.number()),
    fileChecks: v.optional(
      v.record(
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
    ),
    lastValidationAt: v.optional(v.number()),
    lastValidationErrors: v.optional(v.array(v.string())),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byAgent", ["agentId"])
    .index("byWorkspaceAndAgent", ["workspaceId", "agentId"]),

  tasks: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("blocked"),
    ),
    assigneeIds: v.array(v.id("agents")),
    priority: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
      v.literal("none"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.string(),
    dueAt: v.union(v.number(), v.null()),
    blockedReason: v.optional(v.string()),
    blockedAt: v.optional(v.number()),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byStatus", ["status"])
    .index("recent", ["createdAt"])
    .index("byWorkspaceUpdatedAt", ["workspaceId", "updatedAt"]),

  messages: defineTable({
    workspaceId: v.id("workspaces"),
    taskId: v.union(v.id("tasks"), v.null()),
    // Optional for legacy rows: agent-authored task comments created before userId was stored.
    userId: v.optional(v.union(v.id("users"), v.null())),
    agentId: v.union(v.id("agents"), v.null()),
    authorName: v.string(),
    authorImage: v.optional(v.string()),
    content: v.string(),
    attachments: v.array(v.id("documents")),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byTask", ["taskId"])
    .index("recent", ["createdAt"]),

  activities: defineTable({
    workspaceId: v.id("workspaces"),
    type: v.union(
      v.literal("task_created"),
      v.literal("task_updated"),
      v.literal("message_sent"),
      v.literal("agent_status"),
      v.literal("broadcast_sent"),
      v.literal("mention_alert"),
      v.literal("document_created"),
      v.literal("document_updated"),
      v.literal("webhook_event"),
    ),
    agentId: v.union(v.id("agents"), v.null()),
    taskId: v.union(v.id("tasks"), v.null()),
    message: v.string(),
    metadata: v.any(),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("recent", ["createdAt"])
    .index("byWorkspaceCreatedAt", ["workspaceId", "createdAt"]),

  activitySeenByAgent: defineTable({
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    activityId: v.id("activities"),
    seenAt: v.number(),
  })
    .index("byWorkspaceAgent", ["workspaceId", "agentId"])
    .index("byAgentActivity", ["agentId", "activityId"]),

  notifications: defineTable({
    workspaceId: v.id("workspaces"),
    mentionedAgentId: v.id("agents"),
    taskId: v.union(v.id("tasks"), v.null()),
    message: v.string(),
    delivered: v.boolean(),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("undeliveredForAgent", ["mentionedAgentId", "delivered"]),

  taskSeenByAgent: defineTable({
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
    lastSeenAt: v.number(),
  })
    .index("byWorkspaceAgent", ["workspaceId", "agentId"])
    .index("byAgentTask", ["agentId", "taskId"]),

  folders: defineTable({
    name: v.string(),
    workspaceId: v.id("workspaces"),
    parentId: v.optional(v.id("folders")),
    icon: v.optional(v.string()),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byParent", ["parentId"]),

  documents: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    agentId: v.id("agents"),
    lastEditedBy: v.optional(v.id("agents")),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("note"),
      v.literal("journal"),
    ),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("final"), v.literal("archived")),
    ),
    taskId: v.union(v.id("tasks"), v.null()),
    folderId: v.optional(v.id("folders")),
    isGlobalContext: v.optional(v.boolean()),
    version: v.optional(v.number()),
    createdAt: v.float64(),
    updatedAt: v.optional(v.number()),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byTask", ["taskId"])
    .index("byFolder", ["folderId"])
    .index("global", ["isGlobalContext"])
    .index("recent", ["createdAt"]),

  broadcasts: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    targetAgentIds: v.union(v.array(v.id("agents")), v.literal("all")),
    createdBy: v.string(),
    createdAt: v.number(),
    responses: v.array(v.id("messages")),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("recent", ["createdAt"]),

  subscriptions: defineTable({
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    taskId: v.union(v.id("tasks"), v.null()),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byAgent", ["agentId"])
    .index("byTask", ["taskId"]),

  // NOTE: chatMessages/chatEvents tables removed. Chat is OpenClaw WS-only.

});
