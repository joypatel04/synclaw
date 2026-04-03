"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { BroadcastCard } from "@/components/broadcast/BroadcastCard";
import { BroadcastModal } from "@/components/broadcast/BroadcastModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Plus, Radio } from "lucide-react";
import { useState } from "react";

function BroadcastsContent() {
  const { workspaceId, canEdit } = useWorkspace();
  const broadcasts = useQuery(api.broadcasts.list, { workspaceId }) ?? [];
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="mx-auto max-w-4xl p-3 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 border-b border-border-default/65 pb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-status-review/30 bg-status-review/18">
            <Radio className="h-4 w-4 text-status-review" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary">Broadcasts</h1>
            <p className="text-xs text-text-muted hidden sm:block">Send messages to your agents</p>
          </div>
        </div>
        {canEdit && (
          <Button
            onClick={() => setShowModal(true)}
            size="sm"
            className="w-full gap-1.5 bg-accent-orange text-white shadow-[0_10px_24px_rgba(79,70,229,0.35)] hover:bg-accent-orange/90 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            New Broadcast
          </Button>
        )}
      </div>
      {broadcasts.length === 0 ? (
        <EmptyState icon={Radio} title="No broadcasts yet" description="Create a broadcast to send messages to your agents">
          {canEdit && (
            <Button
              onClick={() => setShowModal(true)}
              size="sm"
              className="bg-accent-orange hover:bg-accent-orange/90 text-white gap-1.5 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Create First Broadcast
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {broadcasts.map((b) => (
            <BroadcastCard key={b._id} broadcast={b} />
          ))}
        </div>
      )}
      <BroadcastModal open={showModal} onOpenChange={setShowModal} />
    </div>
  );
}

export default function BroadcastsPage() {
  return <AppLayout><BroadcastsContent /></AppLayout>;
}
