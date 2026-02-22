import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  formatPayloadPreview,
  getValueAtPath,
  isWebhookEventAllowed,
  toDisplayString,
  MAIN_AGENT_SESSION_KEY,
  type WebhookActionTemplate,
  type WebhookMappingConfig,
} from "./lib/webhooks";

type ProcessingResult = {
  status: "processed" | "failed" | "ignored";
  actionResult: Record<string, unknown>;
  errorMessage?: string;
};

async function getMainAgentId(
  ctx: any,
  workspaceId: any,
) {
  const main = await ctx.db
    .query("agents")
    .withIndex("byWorkspaceAndSessionKey", (q: any) =>
      q.eq("workspaceId", workspaceId).eq("sessionKey", MAIN_AGENT_SESSION_KEY),
    )
    .first();
  return main?._id ?? null;
}

function pickEventName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const event = (payload as Record<string, unknown>).event;
  return typeof event === "string" && event.trim() ? event.trim() : null;
}

function resolveTaskTitle(payload: unknown, mapping: WebhookMappingConfig): string {
  const candidate = toDisplayString(
    getValueAtPath(payload, mapping.titlePath ?? "event.type"),
  );
  return candidate ?? "Inbound webhook event";
}

function resolveTaskBody(payload: unknown, mapping: WebhookMappingConfig): string {
  const fromPath = toDisplayString(getValueAtPath(payload, mapping.bodyPath));
  if (fromPath) return fromPath;
  return `Webhook payload:\n\n${formatPayloadPreview(payload)}`;
}

async function processPayload(
  ctx: any,
  args: {
    workspaceId: any;
    webhookId: any;
    payloadId: any;
    payload: unknown;
    actionTemplate: WebhookActionTemplate;
    mappingConfig: WebhookMappingConfig;
    eventFilter: string[];
    source: "ingest" | "reprocess";
  },
): Promise<ProcessingResult> {
  const eventName = pickEventName(args.payload);
  if (!isWebhookEventAllowed(args.eventFilter, eventName)) {
    return {
      status: "ignored",
      actionResult: {
        reason: "event_filtered",
        eventName,
      },
    };
  }

  const now = Date.now();
  const mapping = args.mappingConfig ?? {};
  const mainAgentId = await getMainAgentId(ctx, args.workspaceId);

  try {
    if (args.actionTemplate === "log_activity") {
      await ctx.db.insert("activities", {
        workspaceId: args.workspaceId,
        type: "webhook_event",
        agentId: null,
        taskId: null,
        message: `Webhook payload received (${eventName ?? "unknown_event"})`,
        metadata: {
          source: args.source,
          webhookId: args.webhookId,
          payloadId: args.payloadId,
          eventName,
        },
        createdAt: now,
      });
      return {
        status: "processed",
        actionResult: { activity: true },
      };
    }

    if (args.actionTemplate === "create_document") {
      if (!mainAgentId) {
        return {
          status: "failed",
          actionResult: {},
          errorMessage:
            "No main agent found for workspace. Create main agent first.",
        };
      }
      const title = resolveTaskTitle(args.payload, mapping);
      const content = resolveTaskBody(args.payload, mapping);
      const documentId = await ctx.db.insert("documents", {
        workspaceId: args.workspaceId,
        title,
        content,
        agentId: mainAgentId,
        lastEditedBy: mainAgentId,
        type: "note",
        status: "draft",
        taskId: null,
        isGlobalContext: false,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("activities", {
        workspaceId: args.workspaceId,
        type: "document_created",
        agentId: mainAgentId,
        taskId: null,
        message: `Webhook created document "${title}"`,
        metadata: {
          documentId,
          webhookId: args.webhookId,
          payloadId: args.payloadId,
        },
        createdAt: now,
      });
      return {
        status: "processed",
        actionResult: { documentId },
      };
    }

    const title = resolveTaskTitle(args.payload, mapping);
    const description = resolveTaskBody(args.payload, mapping);
    const priority = mapping.priority ?? "medium";
    const requestedStatus = mapping.status ?? "inbox";
    const assigneeIds = args.actionTemplate === "task_and_nudge_main" && mainAgentId
      ? [mainAgentId]
      : [];
    const status = assigneeIds.length > 0 && requestedStatus === "inbox"
      ? "assigned"
      : requestedStatus;

    const taskId = await ctx.db.insert("tasks", {
      workspaceId: args.workspaceId,
      title,
      description,
      status,
      assigneeIds,
      priority,
      createdBy: "Webhook",
      dueAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activities", {
      workspaceId: args.workspaceId,
      type: "task_created",
      agentId: null,
      taskId,
      message: `Webhook created task "${title}"`,
      metadata: {
        webhookId: args.webhookId,
        payloadId: args.payloadId,
        eventName,
      },
      createdAt: now,
    });

    if (args.actionTemplate === "task_and_nudge_main" && mainAgentId) {
      await ctx.db.insert("activities", {
        workspaceId: args.workspaceId,
        type: "mention_alert",
        agentId: mainAgentId,
        taskId,
        message: `Webhook nudged main agent for task "${title}"`,
        metadata: {
          mentionedAgentIds: [mainAgentId],
          webhookId: args.webhookId,
          payloadId: args.payloadId,
        },
        createdAt: now,
      });

      await ctx.db.insert("notifications", {
        workspaceId: args.workspaceId,
        mentionedAgentId: mainAgentId,
        taskId,
        message: `Webhook event requires review: ${title}`,
        delivered: false,
        createdAt: now,
      });
    }

    return {
      status: "processed",
      actionResult: { taskId },
    };
  } catch (error) {
    return {
      status: "failed",
      actionResult: {},
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export const ingestPayload = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    webhookId: v.id("workspaceWebhooks"),
    providerEventId: v.optional(v.string()),
    headers: v.any(),
    payload: v.any(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.workspaceId !== args.workspaceId) {
      throw new Error("Webhook not found");
    }

    const now = Date.now();

    if (args.providerEventId) {
      const duplicate = await ctx.db
        .query("webhookPayloads")
        .withIndex("byWebhookAndProviderEventId", (q) =>
          q.eq("webhookId", args.webhookId).eq("providerEventId", args.providerEventId),
        )
        .first();
      if (duplicate) {
        return {
          duplicate: true,
          payloadId: duplicate._id,
          status: duplicate.status,
        };
      }
    }

    const payloadId = await ctx.db.insert("webhookPayloads", {
      workspaceId: args.workspaceId,
      webhookId: args.webhookId,
      providerEventId: args.providerEventId,
      headers: args.headers,
      payload: args.payload,
      contentType: args.contentType,
      status: webhook.enabled ? "received" : "ignored",
      receivedAt: now,
      actionResult: webhook.enabled ? undefined : { reason: "webhook_disabled" },
      processedAt: webhook.enabled ? undefined : now,
      errorMessage: undefined,
    });

    if (!webhook.enabled) {
      return { duplicate: false, payloadId, status: "ignored" as const };
    }

    const result = await processPayload(ctx, {
      workspaceId: args.workspaceId,
      webhookId: args.webhookId,
      payloadId,
      payload: args.payload,
      actionTemplate: webhook.actionTemplate,
      mappingConfig: webhook.mappingConfig,
      eventFilter: webhook.eventFilter,
      source: "ingest",
    });

    await ctx.db.patch(payloadId, {
      status: result.status,
      processedAt: now,
      actionResult: result.actionResult,
      errorMessage: result.errorMessage,
    });

    return {
      duplicate: false,
      payloadId,
      status: result.status,
      actionResult: result.actionResult,
      errorMessage: result.errorMessage,
    };
  },
});

export const reprocessPayload = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    payloadId: v.id("webhookPayloads"),
  },
  handler: async (ctx, args) => {
    const payload = await ctx.db.get(args.payloadId);
    if (!payload || payload.workspaceId !== args.workspaceId) {
      throw new Error("Payload not found");
    }
    const webhook = await ctx.db.get(payload.webhookId);
    if (!webhook || webhook.workspaceId !== args.workspaceId) {
      throw new Error("Webhook not found");
    }

    const now = Date.now();
    const result = await processPayload(ctx, {
      workspaceId: args.workspaceId,
      webhookId: payload.webhookId,
      payloadId: payload._id,
      payload: payload.payload,
      actionTemplate: webhook.actionTemplate,
      mappingConfig: webhook.mappingConfig,
      eventFilter: webhook.eventFilter,
      source: "reprocess",
    });

    await ctx.db.patch(payload._id, {
      status: result.status,
      processedAt: now,
      actionResult: result.actionResult,
      errorMessage: result.errorMessage,
    });

    return {
      payloadId: payload._id,
      status: result.status,
      actionResult: result.actionResult,
      errorMessage: result.errorMessage,
    };
  },
});

export const getWebhookSecretHash = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    webhookId: v.id("workspaceWebhooks"),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.workspaceId !== args.workspaceId) {
      return null;
    }
    return {
      secretHash: webhook.secretHash,
      enabled: webhook.enabled,
    };
  },
});
