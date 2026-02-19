"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { AgentRecipeWizard } from "@/components/agents/AgentRecipeWizard";

export default function NewAgentRecipePage() {
  return (
    <AppLayout>
      <AgentRecipeWizard />
    </AppLayout>
  );
}

