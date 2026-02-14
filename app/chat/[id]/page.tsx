"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ChatInterface } from "@/components/chat/ChatInterface";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

function ChatDetailContent({ agentId }: { agentId: Id<"agents"> }) {
  const { workspaceId } = useWorkspace();
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
  if (agent === null) return <div className="flex items-center justify-center py-20"><p className="text-text-muted">Agent not found</p></div>;

  return <ChatInterface agent={agent} />;
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
          <p className="text-sm text-text-muted">
            Missing chat id in route.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ChatDetailContent agentId={id as Id<"agents">} />
    </AppLayout>
  );
}
