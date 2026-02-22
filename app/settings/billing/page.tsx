"use client";

import { useAction, useQuery } from "convex/react";
import { CreditCard, Settings, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { BILLING_ENABLED, WEBHOOKS_ENABLED } from "@/lib/features";

type Currency = "INR" | "USD";
type Cadence = "monthly" | "yearly";
type Tier = "starter" | "pro";

function BillingContent() {
  const { workspaceId, canManage } = useWorkspace();
  const billing = useQuery(api.billing_razorpay.getWorkspacePlan, {
    workspaceId,
  });
  const catalog = useQuery(api.billing_razorpay.getPriceCatalog, {});
  const checkout = useAction(api.billing_razorpay.createSubscriptionCheckout);
  const cancel = useAction(api.billing_razorpay.cancelSubscription);

  const [currency, setCurrency] = useState<Currency>("INR");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [isBusy, setIsBusy] = useState(false);

  const prices = useMemo(() => {
    if (!catalog) return null;
    return {
      starter:
        cadence === "monthly"
          ? catalog.monthly.starter[currency]
          : catalog.yearly.starter[currency],
      pro:
        cadence === "monthly"
          ? catalog.monthly.pro[currency]
          : catalog.yearly.pro[currency],
      savings: catalog.yearlySavingsPercent,
    };
  }, [catalog, cadence, currency]);

  const startCheckout = async (tier: Tier) => {
    setIsBusy(true);
    try {
      const planCode = `${tier}_${cadence}` as
        | "starter_monthly"
        | "starter_yearly"
        | "pro_monthly"
        | "pro_yearly";
      const origin = window.location.origin;
      const result = await checkout({
        workspaceId,
        planCode,
        currency,
        successUrl: `${origin}/settings/billing?checkout=success`,
        cancelUrl: `${origin}/settings/billing?checkout=cancel`,
      });
      window.location.href = result.checkoutUrl;
    } finally {
      setIsBusy(false);
    }
  };

  const cancelSubscription = async () => {
    setIsBusy(true);
    try {
      await cancel({ workspaceId });
    } finally {
      setIsBusy(false);
    }
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl p-3 sm:p-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-bg-secondary py-16">
          <ShieldAlert className="h-10 w-10 text-text-dim mb-3" />
          <p className="text-sm text-text-muted">
            Only workspace owner/admin can manage billing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary">
          <Settings className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Workspace Settings
          </h1>
          <p className="text-xs text-text-muted hidden sm:block">
            Plan, trial, and subscription management
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-8 border-b border-border-default overflow-x-auto">
        <Link
          href="/settings"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
        >
          General
        </Link>
        <Link
          href="/settings/members"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
        >
          Members
        </Link>
        <Link
          href="/settings/openclaw"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
        >
          OpenClaw
        </Link>
        {WEBHOOKS_ENABLED ? (
          <Link
            href="/settings/webhooks"
            className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
          >
            Webhooks
          </Link>
        ) : null}
        <Link
          href="/settings/billing"
          className="border-b-2 border-accent-orange px-4 py-2.5 text-sm font-medium text-accent-orange"
        >
          Billing
        </Link>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Current Plan
              </p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-xl font-semibold text-text-primary">
                  {billing?.plan?.toUpperCase() ?? "FREE"}
                </h2>
                <Badge className="bg-accent-orange/10 text-accent-orange border-accent-orange/20">
                  {billing?.status ?? "active"}
                </Badge>
              </div>
            </div>
            {billing?.providerSubscriptionId ? (
              <Button
                onClick={() => void cancelSubscription()}
                disabled={isBusy}
                className="bg-bg-primary border border-border-default hover:bg-bg-hover text-text-primary"
              >
                <CreditCard className="h-4 w-4 mr-1.5" />
                Cancel at Period End
              </Button>
            ) : null}
          </div>
          {billing?.trialEndsAt ? (
            <p className="mt-3 text-sm text-text-muted">
              Trial ends in{" "}
              <span className="text-text-primary font-medium">
                {billing.trialDaysLeft}
              </span>{" "}
              day(s).
            </p>
          ) : null}
          {billing?.hasPaymentIssue ? (
            <p className="mt-2 text-sm text-status-blocked">
              Payment issue detected.
              {billing.graceDaysLeft > 0
                ? ` Premium access ends in ${billing.graceDaysLeft} day(s).`
                : " Premium features are currently restricted."}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <div>
              <p className="mb-1 text-xs text-text-muted">Currency</p>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as Currency)}
              >
                <SelectTrigger className="bg-bg-primary border-border-default text-text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default">
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs text-text-muted">Cadence</p>
              <Select
                value={cadence}
                onValueChange={(v) => setCadence(v as Cadence)}
              >
                <SelectTrigger className="bg-bg-primary border-border-default text-text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default">
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">
                    Yearly ({prices?.savings ?? 20}% off)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border-default bg-bg-primary p-4">
              <p className="text-sm font-semibold text-text-primary">Starter</p>
              <p className="text-xs text-text-muted mt-1">
                {currency} {prices?.starter ?? "-"}/
                {cadence === "monthly" ? "month" : "year"}
              </p>
              <Button
                className="mt-4 w-full bg-accent-orange hover:bg-accent-orange/90 text-white"
                disabled={isBusy}
                onClick={() => void startCheckout("starter")}
              >
                Choose Starter
              </Button>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-primary p-4">
              <p className="text-sm font-semibold text-text-primary">Pro</p>
              <p className="text-xs text-text-muted mt-1">
                {currency} {prices?.pro ?? "-"}/
                {cadence === "monthly" ? "month" : "year"}
              </p>
              <Button
                className="mt-4 w-full bg-accent-orange hover:bg-accent-orange/90 text-white"
                disabled={isBusy}
                onClick={() => void startCheckout("pro")}
              >
                Choose Pro
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BillingComingSoonContent() {
  return (
    <div className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary">
          <Settings className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Workspace Settings
          </h1>
          <p className="text-xs text-text-muted hidden sm:block">
            Plan, trial, and subscription management
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-8 border-b border-border-default overflow-x-auto">
        <Link
          href="/settings"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
        >
          General
        </Link>
        <Link
          href="/settings/members"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
        >
          Members
        </Link>
        <Link
          href="/settings/openclaw"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
        >
          OpenClaw
        </Link>
        {WEBHOOKS_ENABLED ? (
          <Link
            href="/settings/webhooks"
            className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
          >
            Webhooks
          </Link>
        ) : null}
        <Link
          href="/settings/billing"
          className="border-b-2 border-accent-orange px-4 py-2.5 text-sm font-medium text-accent-orange"
        >
          Billing
        </Link>
      </div>

      <div className="rounded-xl border border-border-default bg-bg-secondary p-6 text-center">
        <h2 className="text-base font-semibold text-text-primary">
          Billing coming soon
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          We are finalizing Razorpay setup and checkout flows. Billing will be
          enabled here soon.
        </p>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <AppLayout>
      {BILLING_ENABLED ? <BillingContent /> : <BillingComingSoonContent />}
    </AppLayout>
  );
}
