"use client";

import { useQuery } from "convex/react";
import { use } from "react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ChatInterface } from "@/components/chat/ChatInterface";

function prettySessionLabel(sessionKey: string): string {
  const parts = sessionKey.split(":");
  if (parts[0] === "agent" && parts.length >= 3) {
    const agentId = parts[1];
    const channel = parts[2];
    return channel === "main" ? agentId : `${agentId} (${channel})`;
  }
  return sessionKey;
}

function ChatSessionContent({ sessionKey }: { sessionKey: string }) {
  const { workspaceId } = useWorkspace();
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const match = agents.find((a) => a.sessionKey === sessionKey) ?? null;

  const agentLike = match ?? {
    name: prettySessionLabel(sessionKey),
    emoji: "💬",
    role: "OpenClaw Session",
    status: "active" as any,
    sessionKey,
  };

  return <ChatInterface agent={agentLike} />;
}

export default function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionKey: string }>;
}) {
  const { sessionKey } = use(params);
  const decoded = decodeURIComponent(sessionKey);
  return (
    <AppLayout>
      <ChatSessionContent sessionKey={decoded} />
    </AppLayout>
  );
}

