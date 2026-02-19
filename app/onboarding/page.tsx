"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
  return (
    <AppLayout>
      <OnboardingWizard />
    </AppLayout>
  );
}
