"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { OpenClawSessionsList } from "./OpenClawSessionsList";

export function ChatAgentSelector() {
  const { workspaceId } = useWorkspace();
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];

  if (agents.length === 0) return <EmptyState icon={MessageSquare} title="No agents available" description="Configure agents first" />;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-dim">
          Agents
        </p>
        <div className="flex flex-col gap-3">
          {agents.map((agent) => {
            return (
              <Link key={agent._id} href={`/chat/${agent._id}`} className="block">
                <div className="group flex items-center gap-4 rounded-xl border border-border-default bg-bg-secondary p-4 transition-smooth hover:border-border-hover hover:bg-bg-tertiary">
                  <AgentAvatar emoji={agent.emoji} name={agent.name} size="lg" status={agent.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-text-primary">{agent.name}</h3><StatusBadge status={agent.status} /></div>
                    <p className="text-xs text-text-muted">{agent.role}</p>
                  </div>
                  <div className="text-text-muted group-hover:text-accent-orange transition-smooth"><MessageSquare className="h-5 w-5" /></div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <OpenClawSessionsList agents={agents} />
    </div>
  );
}
