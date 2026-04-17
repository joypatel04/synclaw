# SEO Action Plan: synclaw.in

Prioritized recommendations from the full audit (score: 19/100).

---

## CRITICAL -- Fix Immediately (Blocks Indexing)

### 1. Convert homepage from CSR to SSR
**Impact:** Search engines currently see a blank spinner. This is the #1 blocker.
**File:** `app/page.tsx`
**Approach:** Split into a server-rendered landing page and a client-side auth gate. The `LandingPageV1` component and its children don't use client hooks -- they can be server-rendered. Only the `useConvexAuth()` check needs to be a client boundary.

### 2. Create robots.txt
**File to create:** `app/robots.ts`
```typescript
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/docs/", "/help/", "/privacy"], disallow: ["/settings/", "/chat/", "/agents/", "/tasks/", "/broadcasts/", "/documents/", "/filesystem/", "/onboarding/", "/admin/", "/super-admin/"] },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
    ],
    sitemap: "https://synclaw.in/sitemap.xml",
  };
}
```

### 3. Create sitemap.xml
**File to create:** `app/sitemap.ts`
Cover: `/`, `/privacy`, `/docs`, `/docs/faq`, `/docs/pricing`, `/docs/public-wss`, `/docs/self-hosted`, `/docs/hosting`, `/help/*`

### 4. Add canonical tags
**File:** `app/layout.tsx`
```typescript
export const metadata: Metadata = {
  metadataBase: new URL("https://synclaw.in"),
  alternates: { canonical: "/" },
  // ...
};
```

### 5. Fix brand URL mismatch
**File:** `config/brand.default.json`
Change `"websiteUrl": "https://synclaw.io"` to `"websiteUrl": "https://synclaw.in"`

---

## HIGH -- Fix This Week (Significant Ranking Impact)

### 6. Add Open Graph + Twitter Card metadata
**File:** `app/layout.tsx`
Add `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`, `twitter:title`, `twitter:image`
**Also:** Create `public/og-image.png` (1200x630)

### 7. Add security headers
**File:** `next.config.ts`
Add: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy`, `Permissions-Policy`

### 8. Add JSON-LD structured data
**File:** `app/layout.tsx`
Add: `Organization`, `WebSite`, `SoftwareApplication` schemas

### 9. Create llms.txt
**File to create:** `public/llms.txt`
Machine-readable content guide for AI search crawlers (GPTBot, ClaudeBot, PerplexityBot)

### 10. Fix title inconsistency
Ensure "Synclaw" is used consistently across all surfaces (title, meta, landing, docs).

### 11. Add per-page metadata to docs
**Files:** All `app/docs/*/page.tsx`
Each docs page needs unique title + description instead of inheriting the generic one.

---

## MEDIUM -- Fix This Month (Optimization)

### 12. Create About page
`/about` returns 404. Include: founder, company story, mission, contact email.

### 13. Create dedicated Pricing page
`/pricing` returns 404. Create a proper comparison table (not just the docs page).

### 14. Add contact information
No email, phone, or contact form exists anywhere on the site.

### 15. Replace "Continue" CTAs
All 4 CTAs say "Continue" -- change to action-oriented: "Get Started Free", "Start Mission Control"

### 16. Change www redirect from 307 to 301
`vercel.json` or Vercel dashboard: www.synclaw.in should 301 to synclaw.in

### 17. Add FAQPage schema to /docs/faq
Add JSON-LD `FAQPage` structured data for rich results.

### 18. Expand FAQ answers to citation-optimal length
Current: 15 words average. Target: 134-167 words per answer.

### 19. Add apple-touch-icon and PNG PWA icons
iOS uses screenshots without proper icons. Add PNG variants.

### 20. Replace placeholder images
Landing page uses SVG placeholders instead of real product screenshots.

---

## LOW -- Backlog (Nice to Have)

### 21. Implement IndexNow protocol for Bing/Yandex
### 22. Add maskable PWA icon variant
### 23. Add hreflang if targeting multiple regions
### 24. Create a blog or changelog for freshness signals
### 25. Build external brand presence (YouTube, Reddit, GitHub)
### 26. Add BreadcrumbList schema to docs pages
### 27. Create "What is Synclaw?" definition page for AI citation

---

## Expected Score Improvement

| Action Set | Estimated Score After |
|------------|----------------------|
| Current state | 19/100 |
| After Critical fixes (1-5) | 45-50/100 |
| After High fixes (6-11) | 60-65/100 |
| After Medium fixes (12-20) | 75-80/100 |
| After all fixes | 80-85/100 |

The single highest-impact change is **#1 (SSR the homepage)** -- it unblocks every other SEO signal.
