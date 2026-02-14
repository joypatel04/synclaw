export function isAllowedWhileLocked(pathname: string) {
  // Owner-only onboarding lock allows a small set of routes so users can
  // complete setup or troubleshoot.
  if (pathname === "/onboarding") return true;
  if (pathname === "/settings") return true;
  if (pathname.startsWith("/settings/")) return true;
  if (pathname === "/help") return true;
  if (pathname.startsWith("/help/")) return true;

  // Allow the Chat landing page so onboarding can be completed inline.
  // Intentionally does NOT allow /chat/* to keep detail views gated.
  if (pathname === "/chat") return true;

  return false;
}
