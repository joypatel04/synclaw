import type { Doc, Id } from "../_generated/dataModel";

export type WorkspacePlan = "free" | "starter" | "pro";
export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";
export type BillingCurrency = "INR" | "USD";

export type FeatureKey =
  | "api_keys"
  | "more_than_three_agents"
  | "priority_support";

export type PlanCode =
  | "starter_monthly"
  | "starter_yearly"
  | "pro_monthly"
  | "pro_yearly";

export const TRIAL_DAYS = 14;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
export const GRACE_DAYS = 7;
export const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

export function defaultTrialEndsAt(now = Date.now()): number {
  return now + TRIAL_MS;
}

export function defaultGraceEndsAt(now = Date.now()): number {
  return now + GRACE_MS;
}

export function normalizeWorkspaceBilling(
  workspace: Doc<"workspaces">,
  now = Date.now(),
) {
  const plan: WorkspacePlan = workspace.plan ?? "free";
  const status: BillingStatus = workspace.billingStatus ?? "active";
  const billingCurrency: BillingCurrency = workspace.billingCurrency ?? "USD";
  const trialEndsAt = workspace.trialEndsAt ?? null;
  const graceEndsAt = workspace.graceEndsAt ?? null;
  const isTrialActive =
    status === "trialing" && trialEndsAt !== null && trialEndsAt > now;
  const isGraceActive =
    status === "past_due" && graceEndsAt !== null && graceEndsAt > now;

  return {
    plan,
    status,
    billingCurrency,
    trialEndsAt,
    graceEndsAt,
    currentPeriodEnd: workspace.currentPeriodEnd ?? null,
    providerCustomerId: workspace.providerCustomerId ?? null,
    providerSubscriptionId: workspace.providerSubscriptionId ?? null,
    isTrialActive,
    isGraceActive,
  };
}

export function workspaceIsPaidAccess(
  workspace: Doc<"workspaces">,
  now = Date.now(),
) {
  const state = normalizeWorkspaceBilling(workspace, now);
  if (state.isTrialActive || state.isGraceActive) return true;
  return (
    state.status === "active" &&
    (state.plan === "starter" || state.plan === "pro")
  );
}

export function maxAgentsForWorkspace(
  workspace: Doc<"workspaces">,
  now = Date.now(),
) {
  // Backward compatibility for pre-billing workspaces.
  if (!workspace.plan && !workspace.billingStatus) {
    return Number.POSITIVE_INFINITY;
  }
  if (workspaceIsPaidAccess(workspace, now)) return Number.POSITIVE_INFINITY;
  return 3;
}

export function canUseFeature(
  workspace: Doc<"workspaces">,
  feature: FeatureKey,
  now = Date.now(),
) {
  // Backward compatibility for pre-billing workspaces.
  if (!workspace.plan && !workspace.billingStatus) {
    return true;
  }
  const state = normalizeWorkspaceBilling(workspace, now);

  // Active trial + grace keep premium capabilities enabled.
  if (state.isTrialActive || state.isGraceActive) return true;
  const paid =
    state.status === "active" &&
    (state.plan === "starter" || state.plan === "pro");

  if (feature === "priority_support") {
    return state.status === "active" && state.plan === "pro";
  }
  if (feature === "api_keys" || feature === "more_than_three_agents") {
    return paid;
  }
  return false;
}

export function planCodeToPlan(planCode: PlanCode): WorkspacePlan {
  return planCode.startsWith("pro_") ? "pro" : "starter";
}

export function planCodeToCadence(planCode: PlanCode): "monthly" | "yearly" {
  return planCode.endsWith("_yearly") ? "yearly" : "monthly";
}

export function resolveRazorpayPlanId(
  planCode: PlanCode,
  currency: BillingCurrency,
): string | null {
  const vars: Record<`${PlanCode}_${BillingCurrency}`, string | undefined> = {
    starter_monthly_INR: process.env.RAZORPAY_PLAN_STARTER_MONTHLY_INR,
    starter_yearly_INR: process.env.RAZORPAY_PLAN_STARTER_YEARLY_INR,
    pro_monthly_INR: process.env.RAZORPAY_PLAN_PRO_MONTHLY_INR,
    pro_yearly_INR: process.env.RAZORPAY_PLAN_PRO_YEARLY_INR,
    starter_monthly_USD: process.env.RAZORPAY_PLAN_STARTER_MONTHLY_USD,
    starter_yearly_USD: process.env.RAZORPAY_PLAN_STARTER_YEARLY_USD,
    pro_monthly_USD: process.env.RAZORPAY_PLAN_PRO_MONTHLY_USD,
    pro_yearly_USD: process.env.RAZORPAY_PLAN_PRO_YEARLY_USD,
  };
  return vars[`${planCode}_${currency}`] ?? null;
}

export function mapRazorpayStatus(status: string): BillingStatus {
  switch (status) {
    case "active":
      return "active";
    case "halted":
      return "past_due";
    case "cancelled":
    case "completed":
      return "canceled";
    case "pending":
    case "authenticated":
      return "incomplete";
    default:
      return "incomplete";
  }
}

export async function resolveWorkspaceIdForProviderIdentifiers(args: {
  db: {
    query: (table: "workspaces") => any;
  };
  explicitWorkspaceId?: Id<"workspaces"> | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
}) {
  if (args.explicitWorkspaceId) return args.explicitWorkspaceId;
  if (args.providerSubscriptionId) {
    const bySub = await args.db
      .query("workspaces")
      .withIndex("byProviderSubscriptionId", (q: any) =>
        q.eq("providerSubscriptionId", args.providerSubscriptionId),
      )
      .first();
    if (bySub) return bySub._id;
  }
  if (args.providerCustomerId) {
    const byCustomer = await args.db
      .query("workspaces")
      .withIndex("byProviderCustomerId", (q: any) =>
        q.eq("providerCustomerId", args.providerCustomerId),
      )
      .first();
    if (byCustomer) return byCustomer._id;
  }
  return null;
}
