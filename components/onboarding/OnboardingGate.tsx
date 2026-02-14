"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAllowedWhileLocked } from "@/lib/onboardingGate";

export function OnboardingGate({ shouldRedirect }: { shouldRedirect: boolean }) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const allowed = isAllowedWhileLocked(pathname);

  const redirectTo = useMemo(() => {
    // Don't propagate transient OAuth query params (e.g. ?code=...) into next.
    if (pathname === "/") return "/onboarding";
    return `/onboarding?next=${encodeURIComponent(pathname)}`;
  }, [pathname]);

  useEffect(() => {
    if (!shouldRedirect) return;
    if (allowed) return;
    router.replace(redirectTo);
  }, [shouldRedirect, allowed, redirectTo, router]);

  return null;
}
