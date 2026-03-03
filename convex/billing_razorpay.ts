import { action, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { requireMember } from "./lib/permissions";
import { requireCapability } from "./lib/edition";
import {
  canUseFeature as workspaceCanUseFeature,
  normalizeWorkspaceBilling,
  planCodeToCadence,
  planCodeToPlan,
  resolveRazorpayPlanId,
  type BillingCurrency,
  type FeatureKey,
  type PlanCode,
} from "./lib/billing";

async function razorpayRequest(path: string, body?: Record<string, unknown>) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET is not configured");
  }
  const basic = btoa(`${keyId}:${keySecret}`);
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.description ?? "Razorpay API request failed");
  }
  return json;
}

export const getWorkspacePlan = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    requireCapability("billing");
    await requireMember(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const now = Date.now();
    const state = normalizeWorkspaceBilling(workspace, now);
    const trialDaysLeft =
      state.trialEndsAt && state.trialEndsAt > now
        ? Math.ceil((state.trialEndsAt - now) / (24 * 60 * 60 * 1000))
        : 0;
    const graceDaysLeft =
      state.graceEndsAt && state.graceEndsAt > now
        ? Math.ceil((state.graceEndsAt - now) / (24 * 60 * 60 * 1000))
        : 0;
    return {
      ...state,
      trialDaysLeft,
      graceDaysLeft,
      hasPaymentIssue:
        state.status === "past_due" || state.status === "incomplete",
    };
  },
});

export const canUseFeature = query({
  args: {
    workspaceId: v.id("workspaces"),
    featureKey: v.union(
      v.literal("api_keys"),
      v.literal("more_than_three_agents"),
      v.literal("priority_support"),
    ),
  },
  handler: async (ctx, args) => {
    requireCapability("billing");
    await requireMember(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    return workspaceCanUseFeature(workspace, args.featureKey as FeatureKey);
  },
});

export const getPriceCatalog = query({
  args: {},
  handler: async () => {
    requireCapability("billing");
    const monthly = {
      starter: {
        INR: 1499,
        USD: 19,
      },
      pro: {
        INR: 3999,
        USD: 49,
      },
    };
    const yearly = {
      starter: {
        INR: Math.round(monthly.starter.INR * 12 * 0.8),
        USD: Math.round(monthly.starter.USD * 12 * 0.8),
      },
      pro: {
        INR: Math.round(monthly.pro.INR * 12 * 0.8),
        USD: Math.round(monthly.pro.USD * 12 * 0.8),
      },
    };
    return {
      yearlySavingsPercent: 20,
      monthly,
      yearly,
      configuredPlanIds: {
        starter_monthly_INR:
          process.env.RAZORPAY_PLAN_STARTER_MONTHLY_INR ?? null,
        starter_yearly_INR:
          process.env.RAZORPAY_PLAN_STARTER_YEARLY_INR ?? null,
        pro_monthly_INR: process.env.RAZORPAY_PLAN_PRO_MONTHLY_INR ?? null,
        pro_yearly_INR: process.env.RAZORPAY_PLAN_PRO_YEARLY_INR ?? null,
        starter_monthly_USD:
          process.env.RAZORPAY_PLAN_STARTER_MONTHLY_USD ?? null,
        starter_yearly_USD:
          process.env.RAZORPAY_PLAN_STARTER_YEARLY_USD ?? null,
        pro_monthly_USD: process.env.RAZORPAY_PLAN_PRO_MONTHLY_USD ?? null,
        pro_yearly_USD: process.env.RAZORPAY_PLAN_PRO_YEARLY_USD ?? null,
      },
    };
  },
});

export const createSubscriptionCheckout = action({
  args: {
    workspaceId: v.id("workspaces"),
    planCode: v.union(
      v.literal("starter_monthly"),
      v.literal("starter_yearly"),
      v.literal("pro_monthly"),
      v.literal("pro_yearly"),
    ),
    currency: v.union(v.literal("INR"), v.literal("USD")),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    requireCapability("billing");
    const workspace = await ctx.runQuery(api.workspaces.getById, {
      workspaceId: args.workspaceId,
    });
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      throw new Error("Only owner/admin can manage billing");
    }

    const planId = resolveRazorpayPlanId(
      args.planCode as PlanCode,
      args.currency as BillingCurrency,
    );
    if (!planId) {
      throw new Error(
        `Missing Razorpay plan env for ${args.planCode} ${args.currency}`,
      );
    }

    const customer = await razorpayRequest("customers", {
      name: workspace.name,
      fail_existing: 0,
      notes: {
        workspaceId: String(args.workspaceId),
      },
    });
    const subscription = await razorpayRequest("subscriptions", {
      plan_id: planId,
      quantity: 1,
      customer_notify: 1,
      total_count:
        planCodeToCadence(args.planCode as PlanCode) === "monthly" ? 120 : 20,
      customer_id: customer.id,
      notes: {
        workspaceId: String(args.workspaceId),
        planCode: args.planCode,
        successUrl: args.successUrl,
        cancelUrl: args.cancelUrl,
      },
    });

    await ctx.runMutation(
      internal.billing_razorpay_internal.upsertProviderBillingLink,
      {
        workspaceId: args.workspaceId,
        providerCustomerId: String(customer.id),
        providerSubscriptionId: String(subscription.id),
        billingCurrency: args.currency,
      },
    );
    await ctx.runMutation(api.workspaces.patchBillingState, {
      workspaceId: args.workspaceId,
      patch: {
        plan: planCodeToPlan(args.planCode as PlanCode),
        billingStatus: "incomplete",
      },
    });

    return {
      checkoutUrl: subscription.short_url as string,
      subscriptionId: subscription.id as string,
    };
  },
});

export const cancelSubscription = action({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireCapability("billing");
    const workspace = await ctx.runQuery(api.workspaces.getById, {
      workspaceId: args.workspaceId,
    });
    if (!workspace) throw new Error("Workspace not found");
    if (workspace.role !== "owner" && workspace.role !== "admin") {
      throw new Error("Only owner/admin can manage billing");
    }
    const plan = await ctx.runQuery(api.billing_razorpay.getWorkspacePlan, {
      workspaceId: args.workspaceId,
    });
    const subId = plan.providerSubscriptionId;
    if (!subId) throw new Error("No Razorpay subscription found");

    await razorpayRequest(`subscriptions/${subId}/cancel`, {
      cancel_at_cycle_end: 1,
    });

    await ctx.runMutation(api.workspaces.patchBillingState, {
      workspaceId: args.workspaceId,
      patch: {
        billingStatus: "canceled",
      },
    });
    return { ok: true };
  },
});
