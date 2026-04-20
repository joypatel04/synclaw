"use client";

import Link from "next/link";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { Timestamp } from "@/components/shared/Timestamp";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agent: Doc<"agents">;
  currentTask?: Doc<"tasks"> | null;
  href?: string;
}

export function AgentCard({ agent, currentTask, href }: AgentCardProps) {
  const model = agent.telemetry?.currentModel;
  const openclawVersion = agent.telemetry?.openclawVersion;
  const showTelemetry =
    (model && model !== "unknown") ||
    (openclawVersion && openclawVersion !== "unknown");
  const isActive = agent.status === "active";

  const content = (
    <div
      className={cn(
        "group min-w-0 overflow-hidden rounded-2xl border border-border-default/75 bg-bg-secondary/70 p-4 transition-smooth",
        "hover:border-border-hover hover:bg-bg-secondary/90",
        agent.status === "active" && "border-l-2 border-l-status-active/90",
        agent.status === "error" && "border-l-2 border-l-status-blocked/90",
        href && "cursor-pointer",
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AgentAvatar
            emoji={agent.emoji}
            name={agent.name}
            size="md"
            status={agent.status}
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text-primary">
              {agent.name}
            </h3>
            <p
              className="line-clamp-2 break-all text-xs leading-4 text-text-muted"
              title={agent.role}
            >
              {agent.role}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "ml-auto mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
            isActive ? "bg-status-active" : "bg-status-idle",
          )}
          title={isActive ? "Active" : "Idle"}
        />
      </div>

      {currentTask && agent.status === "active" && (
        <div className="mt-3 w-full min-w-0 rounded-xl border border-border-default/60 bg-bg-primary/55 px-3 py-2.5">
          <p className="text-xs text-text-muted">Working on</p>
          <p className="mt-0.5 w-full break-words text-xs font-medium leading-relaxed text-text-primary">
            {currentTask.title}
          </p>
        </div>
      )}

      {showTelemetry && (
        <p className="mt-3 text-[11px] text-text-muted truncate">
          {model && model !== "unknown" ? model : "unknown model"}
          {/* {openclawVersion && openclawVersion !== "unknown"
            ? openclawVersion
            : "unknown"} */}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border-default/55 pt-2.5">
        <span className="text-[10px] text-text-dim">Last heartbeat</span>
        <Timestamp time={agent.lastHeartbeat} />
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
