"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ChatInterface } from "@/components/chat/ChatInterface";
import type { Id } from "@/convex/_generated/dataModel";

function ChatDetailContent({ agentId }: { agentId: Id<"agents"> }) {
  const { workspaceId } = useWorkspace();
  const agent = useQuery(api.agents.getById, { workspaceId, id: agentId });

  if (agent === undefined) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" /></div>;
  if (agent === null) return <div className="flex items-center justify-center py-20"><p className="text-text-muted">Agent not found</p></div>;

  return <ChatInterface agent={agent} />;
}

export default function ChatDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  return <AppLayout><ChatDetailContent agentId={id as Id<"agents">} /></AppLayout>;
}
