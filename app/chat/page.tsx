"use client";

import { useQuery } from "convex/react";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { ChatAgentSelector } from "@/components/chat/ChatAgentSelector";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { AGENT_SETUP_ADVANCED_ENABLED } from "@/lib/features";

function ChatContent() {
  const { workspaceId, canAdmin } = useWorkspace();
  const status = useQuery(
    api.onboarding.getStatus,
    canAdmin ? { workspaceId } : "skip",
  );

  if (canAdmin && status === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-border-hover border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="app-page-wide">
      <div className="min-w-0">
        <div className="app-page-header">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal/30 bg-teal/20">
              <MessageSquare className="h-4 w-4 text-teal" />
            </div>
            <div>
              <h1 className="app-page-title">Chat</h1>
              <p className="app-page-subtitle hidden sm:block">
                Direct conversations with your agents
              </p>
            </div>
          </div>
          {canAdmin && AGENT_SETUP_ADVANCED_ENABLED ? (
            <Button asChild variant="outline" size="sm" className="h-8 gap-2">
              <Link href="/help/agent-setup">Setup Guide</Link>
            </Button>
          ) : null}
        </div>
        <ChatAgentSelector />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <AppLayout>
      <ChatContent />
    </AppLayout>
  );
}
