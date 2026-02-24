"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useParams } from "next/navigation";

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
  const agents =
    useQuery(api.agents.list, workspaceId ? { workspaceId } : "skip") ?? [];
  const match = agents.find((a) => a.sessionKey === sessionKey) ?? null;

  const agentLike = match ?? {
    name: prettySessionLabel(sessionKey),
    emoji: "💬",
    role: "OpenClaw Session",
    status: "active" as any,
    sessionKey,
  };

  return (
    <div className="h-full min-h-0">
      <ChatInterface agent={agentLike} className="h-full min-h-0" />
    </div>
  );
}

export default function ChatSessionPage() {
  const params = useParams();
  const rawKey = params?.sessionKey;
  const sessionKey =
    typeof rawKey === "string"
      ? rawKey
      : Array.isArray(rawKey)
        ? rawKey[0]
        : null;

  if (!sessionKey) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl p-6">
          <p className="text-sm text-text-muted">
            Missing session key in route.
          </p>
        </div>
      </AppLayout>
    );
  }

  const decoded = decodeURIComponent(sessionKey);
  return (
    <AppLayout>
      <div className="h-full min-h-0">
        <ChatSessionContent sessionKey={decoded} />
      </div>
    </AppLayout>
  );
}
