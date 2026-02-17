"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { AgentSetupWizard } from "@/components/agents/AgentSetupWizard";

export default function AgentSetupPage() {
  return (
    <AppLayout>
      <AgentSetupWizard />
    </AppLayout>
  );
}

