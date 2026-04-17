"use client";

import { useQuery } from "convex/react";
import { MessageSquare, Settings2 } from "lucide-react";
import Link from "next/link";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { OpenClawSessionsList } from "./OpenClawSessionsList";

export function ChatAgentSelector() {
  const { workspaceId, canEdit, canAdmin } = useWorkspace();
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const openclawSummary = useQuery(api.openclaw.getConfigSummary, {
    workspaceId,
  });

  const hasOpenClaw = Boolean(
    openclawSummary &&
      ((openclawSummary.transportMode ?? "direct_ws") === "connector"
        ? openclawSummary.connectorId
        : openclawSummary.wsUrl),
  );

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
        description="Choose a connection method and complete setup in OpenClaw Settings."
      >
        <Button
          asChild
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
        description="Create your first agent to start chatting."
      >
        {canAdmin ? (
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            asChild
          >
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
      <div className="rounded-2xl border border-border-default/75 bg-bg-secondary/80 p-4 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-dim">
          Agents
        </p>
        <div className="flex flex-col gap-3">
          {agents.map((agent) => {
            return (
              <Link
                key={agent._id}
                href={`/chat/${agent._id}`}
                className="block"
              >
                <div className="group flex items-center gap-4 rounded-xl border border-border-default/70 bg-bg-primary/55 p-4 transition-smooth hover:-translate-y-0.5 hover:border-border-hover hover:bg-bg-hover/70">
                  <AgentAvatar
                    emoji={agent.emoji}
                    name={agent.name}
                    size="lg"
                    status={agent.status}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">
                        {agent.name}
                      </h3>
                      <StatusBadge status={agent.status} />
                    </div>
                    <p className="text-xs text-text-muted">{agent.role}</p>
                  </div>
                  <div className="text-text-muted group-hover:text-text-secondary transition-smooth">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border-default/75 bg-bg-secondary/78 p-3">
        <OpenClawSessionsList agents={agents} />
      </div>
    </div>
  );
}
