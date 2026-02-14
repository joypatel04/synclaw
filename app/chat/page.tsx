"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ChatAgentSelector } from "@/components/chat/ChatAgentSelector";
import { MessageSquare } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

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

  // Inline onboarding in Chat so owners don't have to context-switch.
  if (canAdmin && status && !status.isComplete) {
    return <OnboardingWizard />;
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-6">
      <div className="flex items-center gap-2.5 mb-4 sm:mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal/20"><MessageSquare className="h-4 w-4 text-teal" /></div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">Chat</h1>
          <p className="text-xs text-text-muted hidden sm:block">Direct conversations with your agents</p>
        </div>
      </div>
      <ChatAgentSelector />
    </div>
  );
}

export default function ChatPage() {
  return <AppLayout><ChatContent /></AppLayout>;
}
