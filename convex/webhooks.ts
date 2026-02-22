import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireMember, requireRole } from "./lib/permissions";
import {
  buildWebhookEndpointUrl,
  generateWebhookSecret,
  sha256Hex,
  type WebhookActionTemplate,
  type WebhookMappingConfig,
} from "./lib/webhooks";

const actionTemplateValidator = v.union(
  v.literal("create_task"),
  v.literal("create_document"),
  v.literal("log_activity"),
  v.literal("task_and_nudge_main"),
);

const mappingConfigValidator = v.object({
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
});

export const createWebhook = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    enabled: v.boolean(),
    eventFilter: v.array(v.string()),
    actionTemplate: actionTemplateValidator,
    mappingConfig: mappingConfigValidator,
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "admin");
    const now = Date.now();
    const secret = generateWebhookSecret();
    const secretHash = await sha256Hex(secret);
    const webhookId = await ctx.db.insert("workspaceWebhooks", {
      workspaceId: args.workspaceId,
      name: args.name.trim(),
      description: args.description?.trim(),
      enabled: args.enabled,
      secretHash,
      eventFilter: args.eventFilter.length > 0 ? args.eventFilter : ["*"],
      actionTemplate: args.actionTemplate,
      mappingConfig: args.mappingConfig,
      createdBy: membership.userId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      webhookId,
      secret,
      endpointUrl: buildWebhookEndpointUrl(args.workspaceId, webhookId),
    };
  },
});

export const listWebhooks = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("workspaceWebhooks")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
    return rows.map((row) => ({
      ...row,
      endpointUrl: buildWebhookEndpointUrl(args.workspaceId, row._id),
    }));
  },
});

export const updateWebhook = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    webhookId: v.id("workspaceWebhooks"),
    patch: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      enabled: v.optional(v.boolean()),
      eventFilter: v.optional(v.array(v.string())),
      actionTemplate: v.optional(actionTemplateValidator),
      mappingConfig: v.optional(mappingConfigValidator),
    }),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "admin");
    const row = await ctx.db.get(args.webhookId);
    if (!row || row.workspaceId !== args.workspaceId) {
      throw new Error("Webhook not found");
    }
    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    if (args.patch.name !== undefined) patch.name = args.patch.name.trim();
    if (args.patch.description !== undefined) {
      patch.description = args.patch.description?.trim() || undefined;
    }
    if (args.patch.enabled !== undefined) patch.enabled = args.patch.enabled;
    if (args.patch.eventFilter !== undefined) {
      patch.eventFilter =
        args.patch.eventFilter.length > 0 ? args.patch.eventFilter : ["*"];
    }
    if (args.patch.actionTemplate !== undefined) {
      patch.actionTemplate = args.patch.actionTemplate;
    }
    if (args.patch.mappingConfig !== undefined) {
      patch.mappingConfig = args.patch.mappingConfig;
    }
    await ctx.db.patch(args.webhookId, patch);
  },
});

export const rotateWebhookSecret = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    webhookId: v.id("workspaceWebhooks"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "admin");
    const row = await ctx.db.get(args.webhookId);
    if (!row || row.workspaceId !== args.workspaceId) {
      throw new Error("Webhook not found");
    }
    const secret = generateWebhookSecret();
    const secretHash = await sha256Hex(secret);
    await ctx.db.patch(args.webhookId, { secretHash, updatedAt: Date.now() });
    return { secret };
  },
});

export const deleteWebhook = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    webhookId: v.id("workspaceWebhooks"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "admin");
    const row = await ctx.db.get(args.webhookId);
    if (!row || row.workspaceId !== args.workspaceId) {
      throw new Error("Webhook not found");
    }
    const payloads = await ctx.db
      .query("webhookPayloads")
      .withIndex("byWebhook", (q) => q.eq("webhookId", args.webhookId))
      .collect();
    for (const payload of payloads) {
      await ctx.db.delete(payload._id);
    }
    await ctx.db.delete(args.webhookId);
  },
});

export const listPayloads = query({
  args: {
    workspaceId: v.id("workspaces"),
    webhookId: v.id("workspaceWebhooks"),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("received"),
        v.literal("processed"),
        v.literal("failed"),
        v.literal("ignored"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook || webhook.workspaceId !== args.workspaceId) {
      throw new Error("Webhook not found");
    }
    const rows = await ctx.db
      .query("webhookPayloads")
      .withIndex("byWebhookAndReceivedAt", (q) => q.eq("webhookId", args.webhookId))
      .order("desc")
      .collect();
    const filtered = args.status ? rows.filter((r) => r.status === args.status) : rows;
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, args.pageSize ?? 20));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    return {
      items,
      total: filtered.length,
      page,
      pageSize,
      hasNextPage: start + pageSize < filtered.length,
    };
  },
});

export const getPayload = query({
  args: {
    workspaceId: v.id("workspaces"),
    payloadId: v.id("webhookPayloads"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const payload = await ctx.db.get(args.payloadId);
    if (!payload || payload.workspaceId !== args.workspaceId) {
      return null;
    }
    return payload;
  },
});

export const reprocessWebhookPayload = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    payloadId: v.id("webhookPayloads"),
  },
  handler: async (ctx, args): Promise<any> => {
    await requireRole(ctx, args.workspaceId, "admin");
    return await ctx.runMutation(internal.webhooks_internal.reprocessPayload, args);
  },
});

export const getStats = query({
  args: {
    workspaceId: v.id("workspaces"),
    webhookId: v.id("workspaceWebhooks"),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("webhookPayloads")
      .withIndex("byWebhook", (q) => q.eq("webhookId", args.webhookId))
      .collect();

    let processed = 0;
    let failed = 0;
    let ignored = 0;
    let received = 0;
    for (const row of rows) {
      if (row.status === "processed") processed += 1;
      if (row.status === "failed") failed += 1;
      if (row.status === "ignored") ignored += 1;
      if (row.status === "received") received += 1;
    }
    return {
      total: rows.length,
      processed,
      failed,
      ignored,
      received,
    };
  },
});
