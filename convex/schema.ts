import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const workspaceRole = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer"),
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
  }).index("bySlug", ["slug"]),

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
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    invitedBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
    ),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byEmail", ["email"]),

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

  // ─── Domain tables (all workspace-scoped) ───────────────────────

  agents: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    role: v.string(),
    emoji: v.string(),
    sessionKey: v.string(),
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
        totalTokensUsed: v.number(),
        lastRunDurationMs: v.number(),
        lastRunCost: v.float64(),
      }),
    ),
    lastSeenActivityAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byStatus", ["status"])
    .index("bySessionKey", ["sessionKey"]),

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
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byStatus", ["status"])
    .index("recent", ["createdAt"]),

  messages: defineTable({
    workspaceId: v.id("workspaces"),
    taskId: v.union(v.id("tasks"), v.null()),
    agentId: v.union(v.id("agents"), v.null()),
    authorName: v.string(),
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
    ),
    agentId: v.union(v.id("agents"), v.null()),
    taskId: v.union(v.id("tasks"), v.null()),
    message: v.string(),
    metadata: v.any(),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("recent", ["createdAt"]),

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
      v.union(
        v.literal("draft"),
        v.literal("final"),
        v.literal("archived"),
      ),
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

  chatMessages: defineTable({
    workspaceId: v.id("workspaces"),
    sessionId: v.string(),
    fromUser: v.boolean(),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("bySession", ["sessionId", "createdAt"])
    .index("recent", ["createdAt"]),

  /**
   * Individual agent run records for cost tracking.
   * Each time an agent finishes a task session, a record is created here.
   * This enables accurate per-task and daily burn rate calculations.
   */
  agentRuns: defineTable({
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    taskId: v.union(v.id("tasks"), v.null()),
    cost: v.float64(),
    tokensUsed: v.number(),
    durationMs: v.number(),
    createdAt: v.number(),
  })
    .index("byWorkspace", ["workspaceId"])
    .index("byTask", ["taskId"])
    .index("byAgent", ["agentId"])
    .index("byCreatedAt", ["createdAt"]),
});
