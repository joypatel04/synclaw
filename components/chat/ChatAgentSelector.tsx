"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { MessageSquare, Settings2 } from "lucide-react";
import Link from "next/link";
import { OpenClawSessionsList } from "./OpenClawSessionsList";

export function ChatAgentSelector() {
  const { workspaceId, canEdit, canAdmin } = useWorkspace();
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const openclawSummary = useQuery(api.openclaw.getConfigSummary, { workspaceId });

  const hasOpenClaw = Boolean(openclawSummary && openclawSummary.wsUrl);

  if (!canEdit) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Chat requires member access"
        description="Ask the workspace owner to upgrade your role."
      />
    );
  }

  if (openclawSummary === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  if (!hasOpenClaw) {
    return (
      <EmptyState
        icon={Settings2}
        title="Connect OpenClaw to start chatting"
        description="Configure your OpenClaw gateway URL and token in Settings."
      >
        <Button
          asChild
          className="bg-accent-orange hover:bg-accent-orange/90 text-white"
        >
          <Link href="/settings/openclaw">Open Settings</Link>
        </Button>
      </EmptyState>
    );
  }

  if (agents.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No agents yet"
        description="Create your first agent using recipe flow, then continue setup in Chat."
      >
        {canAdmin ? (
          <Button className="bg-accent-orange hover:bg-accent-orange/90 text-white" asChild>
            <Link href="/agents/new">Create agent (recipe)</Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/settings">Ask owner to create an agent</Link>
          </Button>
        )}
      </EmptyState>
    );
  }

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
