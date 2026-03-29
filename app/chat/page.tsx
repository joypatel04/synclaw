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
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal/20">
              <MessageSquare className="h-4 w-4 text-teal" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-text-primary">
                Chat
              </h1>
              <p className="text-xs text-text-muted hidden sm:block">
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
