// lib/analytics/useUmamiIdentify.ts
// Automatically identifies the current user to Umami when logged in.
// Clears identity on logout. Mount once in the analytics component.
// Adapted for Convex authentication instead of next-auth.

'use client';

import { useEffect, useRef } from 'react';
import { useConvexAuth } from 'convex/react';
import { identifyUser, clearUserIdentity } from './track';

/**
 * Hook that syncs the current user state with Umami identification.
 *
 * When user logs in  → calls umami.identify() with user properties
 * When user logs out → clears the identity
 *
 * Only fires once per user change (deduped via ref).
 */
export function useUmamiIdentify(): void {
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Use a ref to track the last identified state to prevent duplicate calls
  const lastIdentifiedRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Don't do anything while loading
    if (isLoading) return;

    // User is logged in and not yet identified (or state changed)
    if (isAuthenticated && lastIdentifiedRef.current !== true) {
      lastIdentifiedRef.current = true;

      // Identify user with Umami
      // Note: We use a placeholder userId since Convex auth doesn't expose the user ID directly
      // In production, you might want to create a Convex query to get the full user object
      identifyUser({
        userId: 'authenticated', // Placeholder - can be enhanced with actual user ID
        email: '',
        role: 'authenticated',
        subscriptionTier: '',
      });
      return;
    }

    // User logged out (was previously identified)
    if (!isAuthenticated && lastIdentifiedRef.current === true) {
      lastIdentifiedRef.current = false;
      clearUserIdentity();
    }
  }, [isAuthenticated, isLoading]);
}
