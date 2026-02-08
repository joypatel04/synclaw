"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { Timestamp } from "@/components/shared/Timestamp";
import { EmptyState } from "@/components/shared/EmptyState";
import { ArrowLeft, MessageSquare, Radio, Users } from "lucide-react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BroadcastThreadProps { broadcastId: Id<"broadcasts">; }

export function BroadcastThread({ broadcastId }: BroadcastThreadProps) {
  const { workspaceId } = useWorkspace();
  const broadcast = useQuery(api.broadcasts.getById, { workspaceId, id: broadcastId });
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];

  if (broadcast === undefined) return <div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" /></div>;
  if (broadcast === null) return <div className="flex flex-col items-center justify-center py-20 text-center"><p className="text-text-muted">Broadcast not found</p><Link href="/broadcasts" className="mt-2 text-sm text-accent-orange hover:underline">Back to broadcasts</Link></div>;

  const targetAgents = broadcast.targetAgentIds === "all" ? agents : agents.filter((a) => (broadcast.targetAgentIds as string[]).includes(a._id));

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link href="/broadcasts" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-smooth mb-6"><ArrowLeft className="h-4 w-4" />Back to broadcasts</Link>
      <div className="rounded-xl border border-border-default bg-bg-secondary p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-review/20 shrink-0"><Radio className="h-5 w-5 text-status-review" /></div>
          <div className="flex-1"><h1 className="text-xl font-bold text-text-primary">{broadcast.title}</h1><div className="mt-1 flex items-center gap-3"><span className="text-sm text-text-muted">by {broadcast.createdBy}</span><Timestamp time={broadcast.createdAt} /></div></div>
        </div>
        <p className="mt-4 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{broadcast.content}</p>
        <div className="mt-4 flex items-center gap-2"><Users className="h-4 w-4 text-text-muted" /><div className="flex flex-wrap gap-1.5">{targetAgents.map((a) => <span key={a._id} className="inline-flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-0.5 text-xs text-text-secondary">{a.emoji} {a.name}</span>)}</div></div>
      </div>
      <div className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-4"><MessageSquare className="h-4 w-4 text-accent-orange" />Responses ({broadcast.responseMessages?.length ?? 0})</h2>
        {!broadcast.responseMessages || broadcast.responseMessages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No responses yet" description="Agents will respond on their next heartbeat" />
        ) : (
          <ScrollArea className="max-h-[400px]"><div className="space-y-3">{broadcast.responseMessages.map((msg: any) => {
            const agent = agents.find((a) => a._id === msg?.agentId); if (!msg) return null;
            return (<div key={msg._id} className="rounded-lg border border-border-default bg-bg-secondary p-4"><div className="flex items-center gap-2"><span className="text-lg">{agent?.emoji ?? "🤖"}</span><span className="text-sm font-medium text-text-primary">{msg.authorName}</span><Timestamp time={msg.createdAt} /></div><p className="mt-2 text-sm text-text-secondary leading-relaxed">{msg.content}</p></div>);
          })}</div></ScrollArea>
        )}
      </div>
    </div>
  );
}
