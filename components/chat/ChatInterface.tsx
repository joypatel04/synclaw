"use client";

import { useQuery } from "convex/react";
import { ChevronDown, MessageSquare, SquareTerminal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { ChatMessageGroup } from "./ChatMessageGroup";
import { ChatStreamingIndicator } from "./ChatStreamingIndicator";
import { useChatGateway } from "./hooks/useChatGateway";
import { useChatMessages } from "./hooks/useChatMessages";
import { useChatScroll } from "./hooks/useChatScroll";
import { useChatSend } from "./hooks/useChatSend";
import { groupMessages } from "./lib/groupMessages";

// Re-export the type so existing page imports keep working.
export type { UiChatMessage } from "./types";

interface ChatInterfaceProps {
  agent: Pick<
    Doc<"agents">,
    "name" | "emoji" | "role" | "status" | "sessionKey"
  >;
  className?: string;
}

export function ChatInterface({ agent, className }: ChatInterfaceProps) {
  const { workspaceId, canEdit, membershipId } = useWorkspace();
  const members = useQuery(api.workspaces.getMembers, { workspaceId }) ?? [];
  const me = useMemo(
    () => members.find((m) => m._id === membershipId),
    [members, membershipId],
  );

  // ---- Hooks ----
  const {
    messages,
    messagesRef,
    upsertLocal,
    hasSimilarUserMessage,
    makeClientMessageId,
    resetPendingSlot,
  } = useChatMessages();

  const { viewportRef, showScrollDown, scrollToBottom, isMobile } =
    useChatScroll(messages.length);

  const {
    gateway,
    ensureConnected,
    connectionBlock,
    canChat,
    canChatBase,
    isConnectorMode,
    openclawConfig,
    gatewayFeatures,
    gatewayBlocked,
    showGatewayPanel,
    setShowGatewayPanel,
  } = useChatGateway({
    sessionKey: agent.sessionKey,
    workspaceId,
    canEdit,
    upsertLocal,
    hasSimilarUserMessage,
    makeClientMessageId,
    resetPendingSlot,
  });

  const {
    handleSend,
    handleRetry,
    handleAbort,
    isAgentResponding,
    activeRun,
    queuedCount,
    draft,
    draftKey,
  } = useChatSend({
    sessionKey: agent.sessionKey,
    workspaceId: String(workspaceId),
    upsertLocal,
    ensureConnected,
    gateway,
    messagesRef,
    makeClientMessageId,
    hasSimilarUserMessage,
  });

  const [showMobileActions, setShowMobileActions] = useState(false);

  // ---- Message grouping ----
  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  // ---- Render helpers ----
  const renderEmptyState = () => {
    if (!canEdit) {
      return (
        <EmptyState
          icon={MessageSquare}
          title="Chat requires member access"
          description="Ask the workspace owner to upgrade your role."
        />
      );
    }
    if (openclawConfig === undefined) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
        </div>
      );
    }
    if (openclawConfig === null) {
      return (
        <EmptyState
          icon={MessageSquare}
          title="OpenClaw is not configured"
          description="Set your gateway URL and token in Settings to enable chat."
        >
          <Button
            asChild
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
          >
            <Link href="/settings/openclaw">Open Settings</Link>
          </Button>
        </EmptyState>
      );
    }
    if (gatewayBlocked) {
      return (
        <EmptyState
          icon={MessageSquare}
          title="OpenClaw setup required"
          description={
            connectionBlock?.message ??
            "Connection is blocked. Complete pairing and scope setup in OpenClaw settings."
          }
        >
          <Button
            asChild
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
          >
            <Link href="/settings/openclaw">Fix OpenClaw setup</Link>
          </Button>
        </EmptyState>
      );
    }
    if (isConnectorMode) {
      return (
        <EmptyState
          icon={MessageSquare}
          title="Connector mode selected"
          description="This workspace is configured for Private Connector. Finish relay setup to enable chat in browser."
        >
          <Button
            asChild
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
          >
            <Link href="/settings/openclaw">Open OpenClaw settings</Link>
          </Button>
        </EmptyState>
      );
    }
    if (messages.length === 0) {
      return (
        <EmptyState
          icon={MessageSquare}
          title={`Start chatting with ${agent.name}`}
          description="Messages stream directly from OpenClaw"
        />
      );
    }
    return null;
  };

  const emptyState = renderEmptyState();

  return (
    <div
      className={cn(
        "flex h-dvh sm:h-full min-h-0 flex-col overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <ChatHeader
        agent={agent}
        canChatBase={canChatBase}
        canChat={canChat}
        activeRun={activeRun}
        showGatewayPanel={showGatewayPanel}
        setShowGatewayPanel={setShowGatewayPanel}
        handleAbort={handleAbort}
        gatewayFeatures={gatewayFeatures}
        isMobile={isMobile}
        onMobileActionsOpen={() => setShowMobileActions(true)}
      />

      {/* Message area */}
      <div className="relative flex-1 min-h-0">
        <ScrollArea
          className="h-full bg-bg-secondary"
          viewportRef={viewportRef}
        >
          <div className="space-y-4 p-2.5 sm:space-y-5 sm:p-6">
            {emptyState ??
              messageGroups.map((group) => (
                <div key={group.id}>
                  <ChatMessageGroup
                    group={group}
                    agentEmoji={agent.emoji}
                    agentName={agent.name}
                    userName={me?.name}
                    userImage={me?.image ?? undefined}
                  />
                  {/* Retry button for failed user messages */}
                  {group.fromUser &&
                    group.messages.some(
                      (msg) => msg.state === "failed" && msg.externalMessageId,
                    ) &&
                    canChat && (
                      <div className="mt-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            handleRetry(
                              group.messages.find((m) => m.state === "failed")
                                ?.externalMessageId,
                            )
                          }
                        >
                          Retry
                        </Button>
                      </div>
                    )}
                </div>
              ))}
            {isAgentResponding && !emptyState && (
              <ChatStreamingIndicator
                agentEmoji={agent.emoji}
                agentName={agent.name}
              />
            )}
          </div>
        </ScrollArea>

        {showScrollDown && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute bottom-4 right-3 z-10 h-9 w-9 rounded-full shadow-md sm:right-4"
            onClick={() => scrollToBottom("smooth")}
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Composer */}
      <ChatComposer
        key={draftKey}
        onSend={handleSend}
        placeholder={`Message ${agent.name}...`}
        disabled={!canChat}
        initialValue={draft ?? undefined}
        initialValueKey={draftKey}
        statusText={
          queuedCount > 0
            ? `Queued: ${queuedCount} (will send after the agent finishes)`
            : isAgentResponding
              ? "Agent is responding... new messages will be queued"
              : undefined
        }
      />

      {/* Mobile actions drawer */}
      <Drawer open={showMobileActions} onOpenChange={setShowMobileActions}>
        <DrawerContent className="sm:hidden">
          <DrawerHeader className="border-b border-border-default px-4 py-3">
            <DrawerTitle className="text-sm text-text-primary">
              Chat Actions
            </DrawerTitle>
          </DrawerHeader>
          <div className="space-y-3 p-4">
            {canChatBase && (
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowGatewayPanel((v: boolean) => !v)}
                >
                  <SquareTerminal className="h-4 w-4" />
                  {showGatewayPanel
                    ? "Hide OpenClaw Info"
                    : "Show OpenClaw Info"}
                </Button>
              </DrawerClose>
            )}
            {activeRun?.externalRunId && canChat && (
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => void handleAbort()}
                >
                  Stop Current Run
                </Button>
              </DrawerClose>
            )}
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
        </DrawerContent>
      </Drawer>
    </div>
  );
}
