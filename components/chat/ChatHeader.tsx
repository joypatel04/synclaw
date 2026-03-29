"use client";

import { PanelBottomOpen } from "lucide-react";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { Button } from "@/components/ui/button";
import type { UiChatMessage } from "./types";

interface ChatHeaderProps {
  agent: {
    name: string;
    emoji: string;
    role: string;
    status: "active" | "idle" | "error" | "offline";
  };
  canChatBase: boolean;
  canChat: boolean;
  activeRun: UiChatMessage | undefined;
  showGatewayPanel: boolean;
  setShowGatewayPanel: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleAbort: () => void;
  gatewayFeatures: string[];
  isMobile: boolean;
  onMobileActionsOpen: () => void;
}

export function ChatHeader({
  agent,
  canChatBase,
  canChat,
  activeRun,
  showGatewayPanel,
  setShowGatewayPanel,
  handleAbort,
  gatewayFeatures,
  isMobile,
  onMobileActionsOpen,
}: ChatHeaderProps) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-border-default bg-bg-secondary px-3 py-2.5 sm:px-6 sm:py-3">
        <AgentAvatar
          emoji={agent.emoji}
          name={agent.name}
          size={isMobile ? "sm" : "md"}
          status={agent.status}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-text-primary">
            {agent.name}
          </h2>
          <p className="hidden text-xs text-text-muted sm:block">
            {agent.role}
          </p>
        </div>

        {/* Desktop actions */}
        <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 sm:flex">
          {canChatBase && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowGatewayPanel((v: boolean) => !v)}
            >
              OpenClaw
            </Button>
          )}
          {activeRun?.externalRunId && canChat && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleAbort}
            >
              Stop
            </Button>
          )}
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-1.5 sm:hidden">
          {activeRun?.externalRunId && canChat && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleAbort}
            >
              Stop
            </Button>
          )}
          {canChatBase && (
            <Button
              variant="outline"
              size="icon-sm"
              className="h-7 w-7"
              aria-label="Open chat actions"
              onClick={onMobileActionsOpen}
            >
              <PanelBottomOpen className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Gateway feature badges panel */}
      {showGatewayPanel && canChatBase && (
        <div className="border-b border-border-default bg-bg-secondary px-4 py-2 sm:px-6">
          <div className="flex flex-wrap gap-1.5">
            {gatewayFeatures.map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-border-default bg-bg-tertiary px-2 py-0.5 text-[11px] text-text-secondary"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
