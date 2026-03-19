"use client";

import { useParams } from "next/navigation";
import { AgentSetupFlowV2 } from "@/components/agents/AgentSetupFlowV2";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Id } from "@/convex/_generated/dataModel";
import { AGENT_SETUP_ADVANCED_ENABLED } from "@/lib/features";

export default function AgentSetupPage() {
  const params = useParams<{ id?: string | string[] }>();
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  return (
    <AppLayout>
      {id ? (
        <AgentSetupFlowV2
          agentId={id as Id<"agents">}
          advancedEnabled={AGENT_SETUP_ADVANCED_ENABLED}
        />
      ) : (
        <p className="p-6 text-sm text-text-muted">Missing agent id.</p>
      )}
    </AppLayout>
  );
}
