"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "./Header";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";

interface AppLayoutProps {
  children: React.ReactNode;
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
          <p className="text-sm text-text-muted">Loading Sutraha HQ...</p>
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
      <div className="flex min-h-screen flex-col bg-bg-primary">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
