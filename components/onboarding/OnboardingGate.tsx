"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

function isAllowedWhileLocked(pathname: string) {
  if (pathname === "/onboarding") return true;
  if (pathname === "/settings") return true;
  if (pathname.startsWith("/settings/")) return true;
  return false;
}

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
