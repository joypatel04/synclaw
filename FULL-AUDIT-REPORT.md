# Full SEO Audit Report: synclaw.in

**Audit Date:** 2026-04-03
**Domain:** https://synclaw.in
**Product:** Synclaw -- AI Agent Mission Control for OpenClaw
**Stack:** Next.js 16, Convex, React 19, Tailwind CSS 4, hosted on Vercel

---

## Overall SEO Health Score: 19/100

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| Technical SEO | 25% | 24/100 | 6.0 |
| Content Quality | 25% | 28/100 | 7.0 |
| On-Page SEO | 20% | 12/100 | 2.4 |
| Schema / Structured Data | 10% | 0/100 | 0.0 |
| Performance (CWV) | 10% | 20/100 | 2.0 |
| Images | 5% | 15/100 | 0.75 |
| AI Search Readiness (GEO) | 5% | 18/100 | 0.9 |
| **Total** | | | **19.05** |

---

## Executive Summary

### The #1 Problem: Invisible to Search Engines

The entire homepage is a **client-side rendered (CSR) React app**. The `app/page.tsx` file starts with `"use client"` and renders all content via JavaScript. When Googlebot, GPTBot, ClaudeBot, or any crawler fetches the page, they see:

- A loading spinner CSS animation
- A generic title (not the brand name "Synclaw")
- A meta description
- **Zero body text, zero links, zero headings, zero images**

This single issue cascades into every other score. No content = no indexing = no rankings = no AI citations.

### Top 5 Critical Issues

1. **Homepage is 100% client-rendered** -- search engines see a blank spinner
2. **No robots.txt** -- returns 404, no crawler directives
3. **No sitemap.xml** -- returns 404, no URL discovery mechanism
4. **No canonical tags** -- duplicate content risk across URL variants
5. **No structured data** -- zero JSON-LD, zero Schema.org markup of any kind

### Top 5 Quick Wins (Ship Today)

1. Create `app/robots.ts` (15 min)
2. Create `app/sitemap.ts` (30 min)
3. Create `public/llms.txt` for AI crawlers (20 min)
4. Add canonical + Open Graph + Twitter metadata to `app/layout.tsx` (30 min)
5. Fix brand URL in `config/brand.default.json` from `synclaw.io` to `synclaw.in` (2 min)

---

## Technical SEO: 24/100

### Crawlability (5/100)
- **robots.txt**: 404 Not Found -- no `app/robots.ts` exists
- **sitemap.xml**: 404 Not Found -- no `app/sitemap.ts` exists
- **IndexNow**: Not implemented
- **Internal links in server HTML**: Zero (everything is client-rendered)

### Indexability (10/100)
- **Title**: Should match brand name "Synclaw" consistently
- **Meta description**: Present, 155 chars (passes)
- **Canonical tag**: Missing entirely
- **Open Graph**: Missing entirely
- **Twitter Cards**: Missing entirely
- **Brand URL mismatch**: `brand.default.json` says `synclaw.io`, actual domain is `synclaw.in`

### Security Headers (25/100)
- HTTPS: Enforced (308 redirect) -- PASS
- HSTS: `max-age=63072000` -- PASS
- Content-Security-Policy: Missing
- X-Frame-Options: Missing
- X-Content-Type-Options: Missing
- Referrer-Policy: Missing

### URL Structure (60/100)
- HTTP-to-HTTPS: 308 Permanent -- PASS
- www redirect: **307 Temporary** (should be 301)
- Clean URLs: `/docs/`, `/help/`, `/agents/` -- PASS
- No redirect chains -- PASS

### Mobile (55/100)
- Viewport meta: Present and correct -- PASS
- PWA manifest: Present -- PASS
- PWA icons: SVG only (missing PNG for iOS/older Android)
- apple-touch-icon: Missing
- Responsive CSS: Tailwind classes present -- PASS

### JavaScript Rendering (10/100)
- `"use client"` on `app/page.tsx` makes the entire homepage CSR
- Server HTML is an empty shell with a spinner
- 18 JS chunks loaded on homepage
- Convex WebSocket dependency blocks content rendering
- Social media crawlers see nothing (no JS execution)

---

## Content Quality: 28/100

### E-E-A-T Assessment: 16/100

| Dimension | Score | Key Gap |
|-----------|-------|---------|
| Experience | 12/100 | No case studies, no customer stories, placeholder screenshots |
| Expertise | 20/100 | No author credentials, jargon unexplained |
| Authoritativeness | 8/100 | No social proof, no press, no GitHub stars displayed |
| Trustworthiness | 22/100 | No contact info, no about page, no terms of service |

### Content Issues
- **Homepage word count**: ~771 words (rendered) / ~20 words (SSR/crawlable)
- **Thin content**: Docs pages average 60-80 words of nav cards only
- **/about**: 404
- **/pricing**: 404 (buried in `/docs/pricing`)
- **FAQ answers**: Average 15 words (optimal for AI citation: 134-167 words)
- **CTA labels**: All say "Continue" -- vague, no value proposition
- **Brand names**: Ensure consistent use of "Synclaw" across all surfaces

---

## On-Page SEO: 12/100

### Heading Structure
```
H1: "Mission control for your OpenClaw workspace"
  H2: "See every agent in one feed"
  H2: "Move work from inbox to done"
  H2: "Ship with safer operational visibility"
  H2: "What Synclaw shows in real time..."
  H2: "Synclaw gives OpenClaw teams..."
    H3: "Connect once, operate continuously"
    H3: "Provider-flexible by design"
  H3: "Outcome-focused OpenClaw workflows..." (should be H2)
    H4: "Operations teams" / "Product teams" / "Founder-led teams"
  H2: "Book a setup call..."
```
- H3 used where H2 is needed in UseCasesLight section
- No headings visible in server-rendered HTML

### Metadata
- Only 2 of ~50 pages define their own metadata
- All docs pages share the same generic title/description
- No per-page canonical URLs

---

## Schema / Structured Data: 0/100

Zero JSON-LD, zero Microdata, zero RDFa detected across the entire codebase.

**Missing schemas (critical for SaaS)**:
- `Organization` -- brand entity
- `WebSite` + `SearchAction` -- sitelinks search box
- `SoftwareApplication` -- product listing
- `FAQPage` -- FAQ rich results
- `BreadcrumbList` -- docs navigation
- `Product` + `Offer` -- pricing display

---

## Performance (CWV): 20/100

| Metric | Risk Level | Cause |
|--------|-----------|-------|
| LCP | HIGH | Server sends empty shell; content renders after JS execution |
| INP | MEDIUM | 18 JS chunks, full client hydration, Convex WS overhead |
| CLS | HIGH | Full-page shift from spinner to rendered content |

- TTFB: 139ms (good, but delivering empty HTML)
- HTML size: 14KB (tiny -- because it's a spinner)

---

## Images: 15/100

- Zero `<img>` tags in server HTML
- Landing page uses placeholder SVGs (`live-stream-placeholder.svg`, etc.)
- No OG image exists for social sharing
- Missing `apple-touch-icon`

---

## AI Search Readiness (GEO): 18/100

| Dimension | Score |
|-----------|-------|
| Citability | 12/100 |
| Structural Readability | 22/100 |
| Multi-Modal Content | 10/100 |
| Authority Signals | 8/100 |
| Technical Accessibility | 38/100 |

- **llms.txt**: Missing (404)
- **AI crawler access**: Default allow (no robots.txt to set explicit policy)
- **Passage length**: 15-24 words average (optimal: 134-167 words)
- **Direct answer blocks**: None (no "What is Synclaw?" definition)
- **Statistics/evidence**: None citable
- **Wikipedia entity**: Does not exist
- **YouTube presence**: None found
- **npm presence**: `@synclaw/mcp-server@0.1.2` exists

---

## Files Requiring Changes

| File | Change Needed |
|------|--------------|
| `app/page.tsx` | Remove `"use client"`, SSR the landing page |
| `app/layout.tsx` | Add canonical, OG, Twitter, JSON-LD metadata |
| `config/brand.default.json` | Fix `websiteUrl` to `synclaw.in` |
| `next.config.ts` | Add security headers |
| **New**: `app/robots.ts` | Crawler directives + sitemap reference |
| **New**: `app/sitemap.ts` | Dynamic sitemap for all public pages |
| **New**: `public/llms.txt` | AI crawler content guide |
| **New**: `public/og-image.png` | 1200x630 social sharing image |
| All `app/docs/*/page.tsx` | Add per-page metadata exports |
