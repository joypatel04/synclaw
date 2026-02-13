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
import {
  mapGatewayEventForIngest,
  OpenClawBrowserGatewayClient,
  pickRunId,
  pickText,
} from "@/lib/openclaw-gateway-client";
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
  const upsertGatewayEvent = useMutation(api.chatIngest.upsertGatewayEvent);
  const abortRun = useMutation(api.chatMessages.abortRun);
  const retryFailedMessage = useMutation(api.chatMessages.retryFailedMessage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gatewayRef = useRef<OpenClawBrowserGatewayClient | null>(null);
  const connectRef = useRef<Promise<void> | null>(null);

  const useDirectWs =
    process.env.NEXT_PUBLIC_CHAT_DIRECT_WS_ENABLED === "true";
  const useBridge = process.env.NEXT_PUBLIC_CHAT_BRIDGE_ENABLED === "true";

  useEffect(() => {
    if (messages.length === 0) return;
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  useEffect(
    () => () => {
      void gatewayRef.current?.disconnect();
      gatewayRef.current = null;
      connectRef.current = null;
    },
    [agent.sessionKey],
  );

  const makeClientMessageId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const ensureDirectGatewayConnected = async () => {
    if (!useDirectWs) return;
    if (!gatewayRef.current) {
      const scopes = (
        process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_SCOPES ??
        "operator.read,operator.write"
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      gatewayRef.current = new OpenClawBrowserGatewayClient(
        {
          wsUrl: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL ?? "",
          protocol:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_PROTOCOL === "jsonrpc"
              ? "jsonrpc"
              : "req",
          authToken: process.env.NEXT_OPENCLAW_GATEWAY_AUTH_TOKEN,
          password: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_PASSWORD,
          clientId: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_ID ?? "cli",
          clientMode:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_MODE ?? "webchat",
          clientPlatform:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_PLATFORM ?? "web",
          role: process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_ROLE ?? "operator",
          scopes,
          subscribeOnConnect:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_CHAT_SUBSCRIBE === "true",
          subscribeMethod:
            process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_SUBSCRIBE_METHOD ??
            "chat.subscribe",
        },
        async (event) => {
          const mapped = mapGatewayEventForIngest(event, makeClientMessageId());
          if (!mapped || mapped.sessionKey !== agent.sessionKey) return;
          await upsertGatewayEvent({
            workspaceId,
            sessionKey: mapped.sessionKey,
            eventId: mapped.eventId,
            eventType: mapped.eventType,
            eventAt: mapped.eventAt,
            payload: mapped.payload,
            message: mapped.message,
            sessionStatus: mapped.sessionStatus,
            openclawSessionId: mapped.openclawSessionId,
          });
        },
      );
    }

    if (!connectRef.current) {
      connectRef.current = gatewayRef.current.connect().catch((error) => {
        gatewayRef.current = null;
        throw error;
      });
    }
    await connectRef.current;
  };

  const sendDirect = async (content: string) => {
    const clientMessageId = makeClientMessageId();
    await legacySendMessage({
      workspaceId,
      sessionId,
      fromUser: true,
      content,
      role: "user",
      state: "sending",
      externalMessageId: clientMessageId,
    });

    try {
      await ensureDirectGatewayConnected();
      const response = await gatewayRef.current!.sendChat({
        sessionKey: agent.sessionKey,
        content,
        clientMessageId,
      });

      await upsertGatewayEvent({
        workspaceId,
        sessionKey: agent.sessionKey,
        eventId: `direct.user.ack.${clientMessageId}`,
        eventType: "chat.send.ack.user",
        payload:
          typeof response === "object" && response !== null
            ? (response as Record<string, unknown>)
            : { response },
        message: {
          externalMessageId: clientMessageId,
          role: "user",
          fromUser: true,
          content,
          state: "completed",
        },
        sessionStatus: "active",
      });

      const assistantText = pickText(response);
      if (!assistantText) return;
      const runId = pickRunId(response);

      await upsertGatewayEvent({
        workspaceId,
        sessionKey: agent.sessionKey,
        eventId: `direct.assistant.ack.${clientMessageId}`,
        eventType: "chat.send.ack.assistant",
        payload:
          typeof response === "object" && response !== null
            ? (response as Record<string, unknown>)
            : { response },
        message: {
          externalMessageId: runId
            ? `${runId}:assistant`
            : `${clientMessageId}:assistant`,
          externalRunId: runId,
          role: "assistant",
          fromUser: false,
          content: assistantText,
          state: "completed",
        },
        sessionStatus: "idle",
      });
    } catch (error) {
      await upsertGatewayEvent({
        workspaceId,
        sessionKey: agent.sessionKey,
        eventId: `direct.user.fail.${clientMessageId}`,
        eventType: "chat.send.error",
        payload: {
          error:
            error instanceof Error ? error.message : "Unknown gateway error",
        },
        message: {
          externalMessageId: clientMessageId,
          role: "user",
          fromUser: true,
          content,
          state: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown gateway error",
        },
        sessionStatus: "error",
      });
    }
  };

  const handleSend = async (content: string) => {
    if (useDirectWs) {
      await sendDirect(content);
      return;
    }

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
    if (useDirectWs) {
      const failedMessage = messages.find(
        (m) => m.externalMessageId === externalMessageId,
      );
      if (!failedMessage) return;
      await sendDirect(failedMessage.content);
      return;
    }
    await retryFailedMessage({ workspaceId, externalMessageId });
  };

  const activeRun = messages
    .slice()
    .reverse()
    .find((m) => m.externalRunId && m.state === "streaming");

  const handleAbort = async () => {
    if (!activeRun?.externalRunId) return;
    if (useDirectWs) {
      const clientMessageId = makeClientMessageId();
      try {
        await ensureDirectGatewayConnected();
        await gatewayRef.current!.abortChat({
          sessionKey: agent.sessionKey,
          runId: activeRun.externalRunId,
          clientMessageId,
        });
      } finally {
        await upsertGatewayEvent({
          workspaceId,
          sessionKey: agent.sessionKey,
          eventId: `direct.abort.${clientMessageId}`,
          eventType: "chat.abort",
          payload: { runId: activeRun.externalRunId },
          message: {
            externalMessageId:
              activeRun.externalMessageId ?? `${activeRun.externalRunId}:assistant`,
            externalRunId: activeRun.externalRunId,
            role: "assistant",
            fromUser: false,
            content: activeRun.content,
            state: "aborted",
          },
          sessionStatus: "idle",
        });
      }
      return;
    }
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
