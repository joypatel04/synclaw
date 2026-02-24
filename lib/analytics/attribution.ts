// lib/analytics/attribution.ts
// Cross-section attribution tracking via localStorage for synclaw

const ATTRIBUTION_KEY = 'synclaw_last_section';
const ATTRIBUTION_TIMESTAMP_KEY = 'synclaw_last_section_ts';
const ATTRIBUTION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type SectionType =
  | 'dashboard'
  | 'tasks'
  | 'chat'
  | 'files'
  | 'broadcasts'
  | 'docs';

/** Map pathname to section */
export function pathToSection(pathname: string): SectionType | null {
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/filesystem')) return 'files';
  if (pathname.startsWith('/broadcasts')) return 'broadcasts';
  if (pathname.startsWith('/docs')) return 'docs';
  return null;
}

/** Store the last visited section */
export function setLastSection(section: SectionType): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ATTRIBUTION_KEY, section);
    localStorage.setItem(ATTRIBUTION_TIMESTAMP_KEY, Date.now().toString());
  } catch {
    // localStorage might be unavailable (private browsing, quota exceeded)
  }
}

/** Get the last visited section (returns null if expired or missing) */
export function getLastSection(): SectionType | null {
  if (typeof window === 'undefined') return null;
  try {
    const section = localStorage.getItem(ATTRIBUTION_KEY) as SectionType | null;
    const timestamp = localStorage.getItem(ATTRIBUTION_TIMESTAMP_KEY);

    if (!section || !timestamp) return null;

    // Check TTL
    const elapsed = Date.now() - parseInt(timestamp, 10);
    if (elapsed > ATTRIBUTION_TTL_MS) {
      localStorage.removeItem(ATTRIBUTION_KEY);
      localStorage.removeItem(ATTRIBUTION_TIMESTAMP_KEY);
      return null;
    }

    return section;
  } catch {
    return null;
  }
}

/** Build attribution context to attach to conversion events */
export function getAttributionContext(): Record<string, string> {
  const lastSection = getLastSection();
  const ctx: Record<string, string> = {};

  if (lastSection) {
    ctx.attribution_section = lastSection;
  }

  // Also capture the referrer domain
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      ctx.referrer_domain = ref.hostname;
    } catch {
      // invalid URL
    }
  }

  return ctx;
}
