"use client";

import Link from "next/link";
import { WEBHOOKS_ENABLED } from "@/lib/features";
import { cn } from "@/lib/utils";

export type SettingsTabId =
  | "general"
  | "members"
  | "openclaw"
  | "webhooks"
  | "account";

export function WorkspaceSettingsTabs({
  active,
  canManage,
}: {
  active: SettingsTabId;
  canManage: boolean;
}) {
  const base =
    "border-b-2 px-4 py-2.5 text-sm font-medium transition-smooth whitespace-nowrap";
  const activeCls = "border-border-hover text-text-secondary";
  const inactiveCls =
    "border-transparent text-text-muted hover:text-text-primary";

  return (
    <div className="flex gap-1 mb-8 border-b border-border-default overflow-x-auto">
      <Link
        href="/settings"
        className={cn(base, active === "general" ? activeCls : inactiveCls)}
      >
        General
      </Link>
      <Link
        href="/settings/members"
        className={cn(base, active === "members" ? activeCls : inactiveCls)}
      >
        Members
      </Link>
      <Link
        href="/settings/openclaw"
        className={cn(base, active === "openclaw" ? activeCls : inactiveCls)}
      >
        OpenClaw
      </Link>
      {canManage ? (
        <Link href="/admin/cron" className={cn(base, inactiveCls)}>
          Cron
        </Link>
      ) : null}
      {WEBHOOKS_ENABLED ? (
        <Link
          href="/settings/webhooks"
          className={cn(base, active === "webhooks" ? activeCls : inactiveCls)}
        >
          Webhooks
        </Link>
      ) : null}
      <Link
        href="/settings/account"
        className={cn(base, active === "account" ? activeCls : inactiveCls)}
      >
        Account
      </Link>
    </div>
  );
}
