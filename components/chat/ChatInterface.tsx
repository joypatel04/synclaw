"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { MessageSquare } from "lucide-react";
import { useEffect, useRef } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";

interface ChatInterfaceProps {
  agent: Doc<"agents">;
}
type ChatMessageRow = Doc<"chatMessages"> & {
  externalMessageId?: string;
  externalRunId?: string;
  state?:
    | "queued"
    | "sending"
    | "streaming"
    | "completed"
    | "failed"
    | "aborted";
};

export function ChatInterface({ agent }: ChatInterfaceProps) {
  const { workspaceId, canEdit } = useWorkspace();
  const sessionId = `chat:${agent.sessionKey}`;
  const messages = (useQuery(api.chatMessages.listBySession, {
    workspaceId,
    sessionId,
  }) ?? []) as ChatMessageRow[];
  const legacySendMessage = useMutation(api.chatMessages.send);
  const legacySendToAgent = useAction(api.chatActions.sendToAgent);
  const sendFromUser = useMutation(api.chatMessages.sendFromUser);
  const abortRun = useMutation(api.chatMessages.abortRun);
  const retryFailedMessage = useMutation(api.chatMessages.retryFailedMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const handleSend = async (content: string) => {
    const useBridge = process.env.NEXT_PUBLIC_CHAT_BRIDGE_ENABLED === "true";
    if (useBridge) {
      await sendFromUser({
        workspaceId,
        sessionId,
        sessionKey: agent.sessionKey,
        content,
      });
      return;
    }

    await legacySendMessage({
      workspaceId,
      sessionId,
      fromUser: true,
      content,
      role: "user",
      state: "completed",
    });
    await legacySendToAgent({ sessionKey: agent.sessionKey, message: content });
  };

  const handleRetry = async (externalMessageId: string | undefined) => {
    if (!externalMessageId) return;
    await retryFailedMessage({ workspaceId, externalMessageId });
  };

  const activeRun = messages
    .slice()
    .reverse()
    .find((m) => m.externalRunId && m.state === "streaming");

  const handleAbort = async () => {
    if (!activeRun?.externalRunId) return;
    await abortRun({
      workspaceId,
      sessionId,
      externalRunId: activeRun.externalRunId,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-3 border-b border-border-default bg-bg-secondary px-6 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-tertiary text-xl">
          {agent.emoji}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            {agent.name}
          </h2>
          <p className="text-xs text-text-muted">{agent.role}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {activeRun?.externalRunId && canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleAbort}
            >
              Abort Run
            </Button>
          )}
          <span
            className={`h-2 w-2 rounded-full ${agent.status === "active" ? "bg-status-active" : agent.status === "error" ? "bg-status-blocked" : agent.status === "offline" ? "bg-text-muted" : "bg-status-idle"}`}
          />
          <span className="text-xs text-text-muted capitalize">
            {agent.status}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-4 p-6">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={`Start chatting with ${agent.name}`}
              description="Messages are stored and synced in real-time"
            />
          ) : (
            messages.map((msg) => (
              <div key={msg._id}>
                <ChatMessage
                  message={msg}
                  agentEmoji={agent.emoji}
                  agentName={agent.name}
                />
                {msg.state === "failed" && msg.externalMessageId && canEdit && (
                  <div className="mt-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleRetry(msg.externalMessageId)}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <ChatInput
        onSend={handleSend}
        placeholder={`Message ${agent.name}...`}
        disabled={!canEdit}
      />
    </div>
  );
}
