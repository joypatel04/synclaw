// lib/analytics/useScrollDepth.ts
// Tracks scroll depth milestones (25%, 50%, 75%, 90%) on pages for synclaw.
// Fires "page_engagement" events with { depth }.

'use client';

import { useEffect, useRef } from 'react';
import { trackScrollDepth } from './track';

const MILESTONES = [25, 50, 75, 90] as const;

/**
 * Hook to track scroll depth on any page.
 * Only fires each milestone once per page mount.
 *
 * @param pageType - The type of page being tracked
 * @param enabled - Whether tracking is active (default: true)
 */
export function useScrollDepth(pageType: string, enabled = true): void {
  const trackedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Reset tracked milestones on mount
    trackedRef.current = new Set();

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;

      if (docHeight <= 0) return;

      const percent = Math.round((scrollTop / docHeight) * 100);

      for (const milestone of MILESTONES) {
        if (percent >= milestone && !trackedRef.current.has(milestone)) {
          trackedRef.current.add(milestone);
          trackScrollDepth(milestone);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pageType, enabled]);
}
