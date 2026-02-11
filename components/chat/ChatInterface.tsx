"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Doc } from "@/convex/_generated/dataModel";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "@/components/shared/EmptyState";
import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";

interface ChatInterfaceProps { agent: Doc<"agents">; }

export function ChatInterface({ agent }: ChatInterfaceProps) {
  const { workspaceId, canEdit } = useWorkspace();
  const sessionId = `chat:${agent.sessionKey}`;
  const messages = useQuery(api.chatMessages.list, { workspaceId, sessionId }) ?? [];
  const sendMessage = useMutation(api.chatMessages.send);
  const sendToAgent = useAction(api.chatActions.sendToAgent);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const handleSend = async (content: string) => {
    await sendMessage({ workspaceId, sessionId, fromUser: true, content });
    try { await sendToAgent({ sessionKey: agent.sessionKey, message: content }); }
    catch (error) { console.error("Failed to send to agent:", error); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center gap-3 border-b border-border-default bg-bg-secondary px-6 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-tertiary text-xl">{agent.emoji}</div>
        <div><h2 className="text-sm font-semibold text-text-primary">{agent.name}</h2><p className="text-xs text-text-muted">{agent.role}</p></div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${agent.status === "active" ? "bg-status-active" : agent.status === "error" ? "bg-status-blocked" : agent.status === "offline" ? "bg-text-muted" : "bg-status-idle"}`} />
          <span className="text-xs text-text-muted capitalize">{agent.status}</span>
        </div>
      </div>
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-4 p-6">
          {messages.length === 0 ? (
            <EmptyState icon={MessageSquare} title={`Start chatting with ${agent.name}`} description="Messages are stored and synced in real-time" />
          ) : messages.map((msg) => <ChatMessage key={msg._id} message={msg} agentEmoji={agent.emoji} agentName={agent.name} />)}
        </div>
      </ScrollArea>
      <ChatInput onSend={handleSend} placeholder={`Message ${agent.name}...`} disabled={!canEdit} />
    </div>
  );
}
