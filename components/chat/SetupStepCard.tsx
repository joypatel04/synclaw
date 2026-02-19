"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type SetupStepCardProps = {
  title: string;
  description: string;
  done: boolean;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
  helper?: string;
};

export function SetupStepCard({
  title,
  description,
  done,
  actionLabel,
  onAction,
  disabled,
  helper,
}: SetupStepCardProps) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          <p className="mt-1 text-xs text-text-muted">{description}</p>
        </div>
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-wider ${
            done
              ? "border-status-active/40 bg-status-active/10 text-status-active"
              : "border-border-default bg-bg-tertiary text-text-dim"
          }`}
        >
          {done ? <Check className="h-3.5 w-3.5" /> : "todo"}
        </span>
      </div>

      {helper ? <p className="mt-2 text-[11px] text-text-dim">{helper}</p> : null}

      {actionLabel && onAction ? (
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={onAction}
            disabled={disabled || done}
          >
            {done ? "Done" : actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
