// lib/analytics/guards.ts
// Environment guards, bot detection, and debug mode for analytics

const DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true';

/** Check if current environment should track analytics */
export function isTrackingEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  // In development: only send events when debug mode is explicitly on.
  // This lets you verify end-to-end locally with your Umami dashboard
  // without polluting production data when debug is off.
  if (process.env.NODE_ENV !== 'production') {
    return DEBUG; // debug=true → events send; debug=false → silent
  }

  // Production: block localhost (shouldn't happen, but just in case)
  const hostname = window.location.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0'
  ) {
    return false;
  }

  // Block bots
  if (isBot()) return false;

  // Block preview/draft mode (Next.js sets __next_preview_data cookie)
  if (document.cookie.includes('__next_preview_data')) {
    return false;
  }

  return true;
}

/** Detect bots via user agent */
export function isBot(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;
  const botPatterns = [
    /bot/i,
    /crawl/i,
    /spider/i,
    /slurp/i,
    /mediapartners/i,
    /googlebot/i,
    /bingbot/i,
    /yandex/i,
    /baiduspider/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /rogerbot/i,
    /linkedinbot/i,
    /embedly/i,
    /quora link preview/i,
    /showyoubot/i,
    /outbrain/i,
    /pinterest/i,
    /applebot/i,
    /semrushbot/i,
    /ahrefsbot/i,
    /headlesschrome/i,
    /phantomjs/i,
    /lighthouse/i,
    /chrome-lighthouse/i,
  ];

  return botPatterns.some((pattern) => pattern.test(ua));
}

/** Check if analytics debug mode is on */
export function isDebugMode(): boolean {
  return DEBUG;
}

/** Debug logger — logs to console only when debug mode is active */
export function debugLog(eventName: string, data?: Record<string, unknown>): void {
  if (!isDebugMode()) return;

  const timestamp = new Date().toISOString();
  console.log(
    `%c[Umami Debug] %c${eventName}`,
    'color: #7c3aed; font-weight: bold;',
    'color: #059669; font-weight: bold;',
    {
      timestamp,
      data,
      url: typeof window !== 'undefined' ? window.location.href : '',
    }
  );
}
