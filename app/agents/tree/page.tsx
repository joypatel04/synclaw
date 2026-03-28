"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentTree } from "@/components/agents/tree/AgentTree";

function AgentTreeContent() {
  const { workspaceId } = useWorkspace();

  if (!workspaceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full">
      <AgentTree workspaceId={workspaceId} />
    </div>
  );
}

export default function AgentTreePage() {
  return (
    <AppLayout>
      <AgentTreeContent />
    </AppLayout>
  );
}
