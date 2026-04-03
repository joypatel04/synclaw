"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "./Header";
import { BillingBanner } from "./BillingBanner";
import {
  WorkspaceProvider,
  useWorkspace,
} from "@/components/providers/workspace-provider";
import { api } from "@/convex/_generated/api";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { isAllowedWhileLocked as isAllowedWhileLockedRoute } from "@/lib/onboardingGate";
import { brand } from "@/lib/brand";

interface AppLayoutProps {
  children: React.ReactNode;
}

function AuthedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const { workspaceId, canAdmin } = useWorkspace();
  const status = useQuery(api.onboarding.getStatus, { workspaceId });

  const allowed = isAllowedWhileLockedRoute(pathname);

  // Hide nav until we know onboarding is complete (prevents "flash of nav").
  const onboardingLocked =
    canAdmin && (status === undefined || !status.isComplete);

  // Only redirect once status is known.
  const shouldRedirect = canAdmin && status !== undefined && !status.isComplete;
  // Strict gating UX: if owner onboarding status is still loading and we're on a
  // disallowed route, block rendering to avoid flashing the app before redirect.
  const blocking =
    canAdmin && !allowed && (status === undefined || shouldRedirect);

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <OnboardingGate shouldRedirect={shouldRedirect} />
      <Header onboardingLocked={onboardingLocked} />
      <BillingBanner />
      <main className="app-reveal flex-1">
        {blocking ? (
          <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
              <p className="text-sm text-text-muted">Redirecting to setup...</p>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  // Redirect to /login if not authenticated (client-side).
  // We do this here instead of middleware because the auth cookie
  // isn't available on the very first load after OAuth.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
          <p className="text-sm text-text-muted">
            Loading {brand.product.name}...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Show nothing briefly while the redirect fires
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <AuthedShell>{children}</AuthedShell>
    </WorkspaceProvider>
  );
}
