import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  defaultGraceEndsAt,
  mapRazorpayStatus,
  resolveWorkspaceIdForProviderIdentifiers,
  type BillingCurrency,
  type PlanCode,
  type WorkspacePlan,
} from "./lib/billing";

function planFromRazorpayPlanId(planId: string | null | undefined): {
  plan: WorkspacePlan;
  planCode: PlanCode | null;
  currency: BillingCurrency | null;
} {
  const pairs: Array<{
    id: string | undefined;
    plan: WorkspacePlan;
    planCode: PlanCode;
    currency: BillingCurrency;
  }> = [
    {
      id: process.env.RAZORPAY_PLAN_STARTER_MONTHLY_INR,
      plan: "starter",
      planCode: "starter_monthly",
      currency: "INR",
    },
    {
      id: process.env.RAZORPAY_PLAN_STARTER_YEARLY_INR,
      plan: "starter",
      planCode: "starter_yearly",
      currency: "INR",
    },
    {
      id: process.env.RAZORPAY_PLAN_PRO_MONTHLY_INR,
      plan: "pro",
      planCode: "pro_monthly",
      currency: "INR",
    },
    {
      id: process.env.RAZORPAY_PLAN_PRO_YEARLY_INR,
      plan: "pro",
      planCode: "pro_yearly",
      currency: "INR",
    },
    {
      id: process.env.RAZORPAY_PLAN_STARTER_MONTHLY_USD,
      plan: "starter",
      planCode: "starter_monthly",
      currency: "USD",
    },
    {
      id: process.env.RAZORPAY_PLAN_STARTER_YEARLY_USD,
      plan: "starter",
      planCode: "starter_yearly",
      currency: "USD",
    },
    {
      id: process.env.RAZORPAY_PLAN_PRO_MONTHLY_USD,
      plan: "pro",
      planCode: "pro_monthly",
      currency: "USD",
    },
    {
      id: process.env.RAZORPAY_PLAN_PRO_YEARLY_USD,
      plan: "pro",
      planCode: "pro_yearly",
      currency: "USD",
    },
  ];

  const match = pairs.find((p) => p.id && p.id === planId);
  if (!match) return { plan: "free", planCode: null, currency: null };
  return {
    plan: match.plan,
    planCode: match.planCode,
    currency: match.currency,
  };
}

function pickPaymentEntity(payload: any): any | null {
  return payload?.payment?.entity ?? payload?.payment ?? null;
}

export const upsertProviderBillingLink = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    providerCustomerId: v.optional(v.string()),
    providerSubscriptionId: v.optional(v.string()),
    billingCurrency: v.optional(v.union(v.literal("INR"), v.literal("USD"))),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.providerCustomerId)
      patch.providerCustomerId = args.providerCustomerId;
    if (args.providerSubscriptionId)
      patch.providerSubscriptionId = args.providerSubscriptionId;
    if (args.billingCurrency) patch.billingCurrency = args.billingCurrency;
    await ctx.db.patch(args.workspaceId, patch);
  },
});

export const processWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    eventType: v.string(),
    payloadDigest: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("razorpayEvents")
      .withIndex("byProviderEventId", (q) =>
        q.eq("providerEventId", args.providerEventId),
      )
      .first();
    if (duplicate) {
      return { ok: true, duplicate: true, workspaceId: duplicate.workspaceId };
    }

    const payload = args.payload?.payload ?? {};
    const subscriptionEntity = payload?.subscription?.entity ?? null;
    const paymentEntity = pickPaymentEntity(payload);
    const explicitWorkspaceId =
      paymentEntity?.notes?.workspaceId ??
      subscriptionEntity?.notes?.workspaceId ??
      args.payload?.notes?.workspaceId ??
      null;
    const providerCustomerId =
      subscriptionEntity?.customer_id ?? paymentEntity?.customer_id ?? null;
    const providerSubscriptionId =
      subscriptionEntity?.id ?? paymentEntity?.subscription_id ?? null;

    const workspaceId = await resolveWorkspaceIdForProviderIdentifiers({
      db: ctx.db,
      explicitWorkspaceId,
      providerCustomerId,
      providerSubscriptionId,
    });
    if (!workspaceId) {
      throw new Error("Unable to resolve workspace for Razorpay event");
    }

    const patch: Record<string, unknown> = {};
    if (providerCustomerId) patch.providerCustomerId = providerCustomerId;
    if (providerSubscriptionId)
      patch.providerSubscriptionId = providerSubscriptionId;

    const planId = subscriptionEntity?.plan_id ?? null;
    const mapped = planFromRazorpayPlanId(planId);
    if (mapped.plan !== "free") patch.plan = mapped.plan;
    if (mapped.currency) patch.billingCurrency = mapped.currency;

    if (args.eventType === "subscription.activated") {
      patch.billingStatus = "active";
      patch.graceEndsAt = undefined;
    } else if (args.eventType === "subscription.charged") {
      patch.billingStatus = "active";
      patch.graceEndsAt = undefined;
      if (typeof subscriptionEntity?.current_end === "number") {
        patch.currentPeriodEnd = subscriptionEntity.current_end * 1000;
      }
    } else if (args.eventType === "payment.failed") {
      patch.billingStatus = "past_due";
      patch.graceEndsAt = defaultGraceEndsAt();
    } else if (
      args.eventType === "subscription.halted" ||
      args.eventType === "subscription.cancelled"
    ) {
      patch.billingStatus = "canceled";
      patch.graceEndsAt = undefined;
    } else if (args.eventType === "subscription.completed") {
      patch.billingStatus = "canceled";
      patch.graceEndsAt = undefined;
    } else if (subscriptionEntity?.status) {
      patch.billingStatus = mapRazorpayStatus(subscriptionEntity.status);
      if (patch.billingStatus === "active") patch.graceEndsAt = undefined;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(workspaceId, patch);
    }

    await ctx.db.insert("razorpayEvents", {
      workspaceId,
      eventType: args.eventType,
      providerEventId: args.providerEventId,
      payloadDigest: args.payloadDigest,
      createdAt: Date.now(),
    });

    return { ok: true, duplicate: false, workspaceId };
  },
});
