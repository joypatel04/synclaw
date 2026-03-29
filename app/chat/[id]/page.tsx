"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AGENT_SETUP_ADVANCED_ENABLED } from "@/lib/features";

function ChatDetailContent({ agentId }: { agentId: Id<"agents"> }) {
  const { workspaceId, canAdmin } = useWorkspace();
  const agent = useQuery(
    api.agents.getById,
    workspaceId ? { workspaceId, id: agentId } : "skip",
  );

  if (agent === undefined)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  if (agent === null)
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-muted">Agent not found</p>
      </div>
    );

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col p-3 sm:p-6">
      <div className="min-w-0 flex-1 min-h-0 flex flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          {canAdmin && AGENT_SETUP_ADVANCED_ENABLED ? (
            <Button asChild variant="outline" size="sm" className="h-8 gap-2">
              <Link href={`/agents/${agentId}/setup`}>Setup Guide</Link>
            </Button>
          ) : null}
        </div>
        <ChatInterface agent={agent} className="flex-1 min-h-0" />
      </div>
    </div>
  );
}

export default function ChatDetailPage() {
  const params = useParams();
  const rawId = params?.id;
  const id =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : null;

  if (!id) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl p-6">
          <p className="text-sm text-text-muted">Missing chat id in route.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full min-h-0">
        <ChatDetailContent agentId={id as Id<"agents">} />
      </div>
    </AppLayout>
  );
}
