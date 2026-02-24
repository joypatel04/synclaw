// lib/analytics/useUmamiPageview.ts
// SPA navigation tracking for Next.js App Router for synclaw
// Manually fires pageview on route change since App Router doesn't reload pages.

'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPage } from './track';
import { pathToSection, setLastSection } from './attribution';

/** Derive a human-readable page type from the pathname */
function derivePageType(pathname: string): string {
  // Dashboard
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard';

  // Tasks
  if (pathname === '/tasks') return 'tasks-listing';
  if (/^\/tasks\/[^/]+$/.test(pathname)) return 'task-detail';
  if (/^\/tasks\/[^/]+\/edit$/.test(pathname)) return 'task-edit';

  // Chat
  if (pathname === '/chat') return 'chat-listing';
  if (/^\/chat\/[^/]+$/.test(pathname)) return 'chat-detail';
  if (/^\/chat\/session\/[^/]+$/.test(pathname)) return 'chat-session';

  // Files
  if (pathname === '/filesystem') return 'files-dashboard';

  // Broadcasts
  if (pathname === '/broadcasts') return 'broadcasts-listing';
  if (/^\/broadcasts\/[^/]+$/.test(pathname)) return 'broadcast-detail';

  // Documentation
  if (pathname.startsWith('/docs')) return 'docs-page';

  // V3/Version pages
  if (pathname === '/v3') return 'v3-dashboard';

  return 'other';
}

/**
 * Hook that tracks pageviews on every SPA route change.
 * Mount this once in the root layout (via UmamiAnalytics component).
 */
export function useUmamiPageview(): void {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedRef = useRef<string>('');

  useEffect(() => {
    // Build full URL for dedup
    const fullUrl = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;

    // Prevent duplicate tracking for same URL
    if (fullUrl === lastTrackedRef.current) return;
    lastTrackedRef.current = fullUrl;

    const pageType = derivePageType(pathname);

    // Track the pageview (debug log happens inside send())
    trackPage(pageType, {
      url: pathname,
      search: searchParams?.toString() ?? '',
    });

    // Update attribution if on a section page
    const section = pathToSection(pathname);
    if (section) {
      setLastSection(section);
    }
  }, [pathname, searchParams]);
}
