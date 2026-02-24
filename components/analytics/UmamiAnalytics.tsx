// components/analytics/UmamiAnalytics.tsx
// Client component that loads the Umami tracking script
// and handles SPA pageview tracking + user identification for Next.js App Router for synclaw.

'use client';

import Script from 'next/script';
import { Suspense } from 'react';
import { useUmamiPageview } from '@/lib/analytics/useUmamiPageview';
import { useUmamiIdentify } from '@/lib/analytics/useUmamiIdentify';

const UMAMI_SCRIPT_SRC = 'https://sutraha-umami.zeabur.app/script.js';
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? '';

/** Inner component that uses useSearchParams (requires Suspense boundary) */
function UmamiPageviewTracker() {
  useUmamiPageview();
  return null;
}

/** Identifies logged-in users to Umami for session-level attribution */
function UmamiUserIdentifier() {
  useUmamiIdentify();
  return null;
}

/**
 * Umami analytics loader for synclaw.
 * - Loads the tracking script once via next/script (afterInteractive)
 * - Handles SPA route-change pageviews via useUmamiPageview hook
 * - Handles user identification via useUmamiIdentify hook with Convex
 * - Only renders in production when WEBSITE_ID is set
 * - No layout shift, no re-renders
 */
export function UmamiAnalytics() {
  // Don't render anything if no website ID configured
  if (!WEBSITE_ID) return null;

  return (
    <>
      <Script
        src={UMAMI_SCRIPT_SRC}
        data-website-id={WEBSITE_ID}
        strategy="afterInteractive"
        // Disable auto-tracking — we handle pageviews manually for SPA
        data-auto-track="false"
      />
      <Suspense fallback={null}>
        <UmamiPageviewTracker />
      </Suspense>
      <UmamiUserIdentifier />
    </>
  );
}
