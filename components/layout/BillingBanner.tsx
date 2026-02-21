"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { BILLING_ENABLED } from "@/lib/features";

export function BillingBanner() {
  if (!BILLING_ENABLED) return null;
  const { workspaceId, canManage } = useWorkspace();
  const plan = useQuery(api.billing_razorpay.getWorkspacePlan, {
    workspaceId,
  });
  if (!canManage || !plan) return null;

  if (plan.hasPaymentIssue) {
    return (
      <div className="border-b border-status-blocked/40 bg-status-blocked/10 px-4 py-2 text-xs text-status-blocked">
        Billing issue detected for this workspace.{" "}
        <Link href="/settings/billing" className="underline underline-offset-2">
          Update billing
        </Link>
        .
        {plan.graceDaysLeft > 0
          ? ` Premium access ends in ${plan.graceDaysLeft} day(s).`
          : ""}
      </div>
    );
  }

  if (plan.trialDaysLeft > 0 && plan.trialDaysLeft <= 3) {
    return (
      <div className="border-b border-status-review/40 bg-status-review/10 px-4 py-2 text-xs text-status-review">
        Trial ends in {plan.trialDaysLeft} day(s).{" "}
        <Link href="/settings/billing" className="underline underline-offset-2">
          Choose a plan
        </Link>
        .
      </div>
    );
  }

  return null;
}
