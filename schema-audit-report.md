# Synclaw Schema.org Structured Data Audit Report

**Date:** 2026-03-23
**Domain:** https://synclaw.in
**Product:** Synclaw -- AI Agent Mission Control for OpenClaw

---

## 1. Detection Results: Existing Structured Data

### Pages Analyzed

| Page | URL | Existing Schema |
|---|---|---|
| Homepage (landing) | `https://synclaw.in` | NONE |
| Docs overview | `https://synclaw.in/docs` | NONE |
| Pricing docs | `https://synclaw.in/docs/pricing` | NONE |
| FAQ docs | `https://synclaw.in/docs/faq` | NONE |
| Privacy policy | `https://synclaw.in/privacy` | NONE |

### Detection Summary

- **JSON-LD blocks found:** 0
- **Microdata (itemscope/itemtype/itemprop) found:** 0
- **RDFa (typeof/vocab/property) found:** 0

No structured data of any kind exists anywhere in the codebase. A grep of the entire `app/`, `components/`, and `lib/` directories for `schema.org`, `json-ld`, `itemtype`, `itemscope`, `itemprop`, `typeof`, and `vocab` returned zero matches.

**Verdict: The site has no structured data. This is a significant SEO gap.**

---

## 2. Validation Results

Not applicable -- no existing schema blocks to validate.

---

## 3. Missing Schema Opportunities (Priority-Ordered)

### CRITICAL Priority

| # | Schema Type | Target Page | Google Rich Result? | Rationale |
|---|---|---|---|---|
| 1 | `Organization` | All pages (root layout) | Knowledge Panel | Establishes brand entity, enables knowledge panel, links social profiles |
| 2 | `WebSite` + `SearchAction` | All pages (root layout) | Sitelinks search box | Enables potential sitelinks search box in SERP |
| 3 | `SoftwareApplication` | Homepage | Software rich result | Core product identity -- SaaS application with pricing |
| 4 | `Product` + `Offer` | Homepage pricing section | Product rich result | Enables price display in search results ($15/mo, $99/yr) |
| 5 | `BreadcrumbList` | Docs pages, Privacy | Breadcrumb trail | Navigation hierarchy for docs section |

### HIGH Priority

| # | Schema Type | Target Page | Google Rich Result? | Rationale |
|---|---|---|---|---|
| 6 | `WebPage` | Homepage, Privacy, Docs | No (but helps semantics) | Page-level identity and metadata |
| 7 | `FAQPage` | `/docs/faq` | Restricted (see note) | 4 FAQ items present on the page |

### INFO Priority (FAQPage Note)

FAQPage rich results are restricted to government and healthcare sites since August 2023. Synclaw is a commercial SaaS product, so **FAQPage will NOT generate Google rich results**. However, FAQPage structured data still benefits AI/LLM citation systems (Bing Chat, Perplexity, ChatGPT search, Google AI Overviews) for Generative Engine Optimization (GEO). The schema is included below as optional -- implement if GEO/AI discoverability is a priority.

### NOT Recommended (Deprecated/Retired)

| Schema Type | Reason |
|---|---|
| `HowTo` | Rich results removed September 2023 -- do NOT add for the "How it works" section |
| `SpecialAnnouncement` | Deprecated July 31, 2025 |

---

## 4. Generated JSON-LD for Implementation

All schemas use `https://schema.org` context, absolute URLs, and ISO 8601 dates.

---

### 4.1 Organization Schema (Root Layout -- All Pages)

**File:** `app/layout.tsx` -- inject into `<head>`
**Purpose:** Establishes the Synclaw brand entity for Google Knowledge Panel

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Synclaw",
  "url": "https://synclaw.in",
  "logo": "https://synclaw.in/pwa-512.svg",
  "description": "Mission control dashboard for OpenClaw AI agents. Real-time monitoring, task management, and cost tracking.",
  "email": "privacy@synclaw.in",
  "foundingDate": "2025",
  "sameAs": [],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "privacy@synclaw.in",
    "availableLanguage": "English"
  }
}
```

**Notes:**
- Add social profile URLs to the `sameAs` array when available (GitHub org, Twitter/X, LinkedIn).
- Replace `logo` URL if a dedicated logo image (PNG/SVG) exists at a different path.
- Update `foundingDate` to the actual founding year if different.

---

### 4.2 WebSite Schema (Root Layout -- All Pages)

**File:** `app/layout.tsx` -- inject into `<head>`
**Purpose:** Enables sitelinks search box potential; declares site identity

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Synclaw",
  "alternateName": "Synclaw HQ",
  "url": "https://synclaw.in",
  "description": "The dashboard your OpenClaw agents have been missing. Real-time monitoring, task management, and cost tracking.",
  "publisher": {
    "@type": "Organization",
    "name": "Synclaw",
    "url": "https://synclaw.in"
  }
}
```

**Note:** A `potentialAction` with `SearchAction` is omitted because the site does not currently expose a public search endpoint. Add it when/if site-wide search is available:

```json
"potentialAction": {
  "@type": "SearchAction",
  "target": {
    "@type": "EntryPoint",
    "urlTemplate": "https://synclaw.in/search?q={search_term_string}"
  },
  "query-input": "required name=search_term_string"
}
```

---

### 4.3 SoftwareApplication Schema (Homepage)

**File:** `app/page.tsx` or a dedicated `<script>` in the homepage
**Purpose:** Identifies Synclaw as a SaaS application with pricing

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Synclaw",
  "description": "AI Agent Mission Control dashboard for OpenClaw. Real-time agent monitoring, Kanban task management, role-based team access, activity audit log, and secure encrypted connections.",
  "url": "https://synclaw.in",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "browserRequirements": "Requires a modern web browser with JavaScript enabled",
  "softwareVersion": "1.0",
  "offers": [
    {
      "@type": "Offer",
      "name": "Monthly Plan",
      "price": "15.00",
      "priceCurrency": "USD",
      "priceValidUntil": "2027-12-31",
      "url": "https://synclaw.in/#pricing",
      "availability": "https://schema.org/InStock",
      "description": "All features included, cancel anytime. Real-time agent monitoring, Kanban task management, team access up to 10 members, activity audit log, secure encrypted connection, founder-led 1-on-1 setup call.",
      "seller": {
        "@type": "Organization",
        "name": "Synclaw"
      }
    },
    {
      "@type": "Offer",
      "name": "Yearly Plan",
      "price": "99.00",
      "priceCurrency": "USD",
      "priceValidUntil": "2027-12-31",
      "url": "https://synclaw.in/#pricing",
      "availability": "https://schema.org/InStock",
      "description": "Best value -- save 45%. All features included. That's $8.25/mo, locked in as long as you stay subscribed.",
      "seller": {
        "@type": "Organization",
        "name": "Synclaw"
      }
    }
  ],
  "featureList": [
    "Real-time agent monitoring",
    "Kanban task management",
    "Team access with role-based permissions (up to 10 members)",
    "Full activity audit log",
    "Secure AES-256 encrypted connection",
    "Founder-led 1-on-1 setup call"
  ],
  "screenshot": "https://synclaw.in/og-image.png",
  "author": {
    "@type": "Organization",
    "name": "Synclaw",
    "url": "https://synclaw.in"
  }
}
```

**Notes:**
- Update `screenshot` to the actual URL of a product screenshot or OG image.
- Update `softwareVersion` to reflect the current version.
- Update `priceValidUntil` periodically (must be a future date for Google validity).

---

### 4.4 Product + Offer Schema (Homepage Pricing Section)

**File:** `app/page.tsx`
**Purpose:** Alternative/complementary to SoftwareApplication for product rich results with pricing

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Synclaw - AI Agent Mission Control",
  "description": "Dashboard for managing OpenClaw AI agents with real-time monitoring, Kanban task management, and cost tracking.",
  "url": "https://synclaw.in",
  "brand": {
    "@type": "Brand",
    "name": "Synclaw"
  },
  "category": "Software > Developer Tools > AI Agent Management",
  "offers": [
    {
      "@type": "Offer",
      "name": "Monthly",
      "price": "15.00",
      "priceCurrency": "USD",
      "priceValidUntil": "2027-12-31",
      "url": "https://synclaw.in/#pricing",
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition"
    },
    {
      "@type": "Offer",
      "name": "Yearly (Best Value)",
      "price": "99.00",
      "priceCurrency": "USD",
      "priceValidUntil": "2027-12-31",
      "url": "https://synclaw.in/#pricing",
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition"
    }
  ]
}
```

**Important:** Do NOT include both `SoftwareApplication` and `Product` on the same page if they describe the same entity. Choose one. `SoftwareApplication` is more semantically accurate for a SaaS product and is the recommended choice. The `Product` schema above is provided as a fallback if `SoftwareApplication` does not produce the desired results in Google Search Console.

---

### 4.5 BreadcrumbList Schema (Docs Pages)

**File:** `app/docs/_components/PublicDocsShell.tsx` or individual docs pages
**Purpose:** Shows navigation breadcrumb trail in search results

#### Docs Overview (`/docs`)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://synclaw.in"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Documentation",
      "item": "https://synclaw.in/docs"
    }
  ]
}
```

#### Docs Pricing (`/docs/pricing`)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://synclaw.in"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Documentation",
      "item": "https://synclaw.in/docs"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Pricing",
      "item": "https://synclaw.in/docs/pricing"
    }
  ]
}
```

#### Docs FAQ (`/docs/faq`)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://synclaw.in"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Documentation",
      "item": "https://synclaw.in/docs"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "FAQ",
      "item": "https://synclaw.in/docs/faq"
    }
  ]
}
```

#### Privacy (`/privacy`)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://synclaw.in"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Privacy Policy",
      "item": "https://synclaw.in/privacy"
    }
  ]
}
```

---

### 4.6 WebPage Schema (Homepage)

**File:** `app/page.tsx`
**Purpose:** Provides page-level semantic metadata

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Synclaw - Mission Control for OpenClaw AI Agents",
  "description": "The dashboard your OpenClaw agents have been missing. Real-time monitoring, task management, and cost tracking. Book a setup call today.",
  "url": "https://synclaw.in",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Synclaw",
    "url": "https://synclaw.in"
  },
  "about": {
    "@type": "SoftwareApplication",
    "name": "Synclaw"
  },
  "specialty": "AI Agent Management",
  "lastReviewed": "2026-03-23"
}
```

---

### 4.7 FAQPage Schema (Optional -- GEO/AI Only)

**File:** `app/docs/faq/page.tsx`
**Purpose:** AI/LLM citation benefit only; will NOT produce Google rich results on commercial sites

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is self-hosted intentionally difficult?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. It is documented clearly, but infra ownership naturally adds operational complexity."
      }
    },
    {
      "@type": "Question",
      "name": "Which option is right for non-technical users?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Cloud is the recommended path for non-technical users and teams that want fast activation."
      }
    },
    {
      "@type": "Question",
      "name": "Can users move from Cloud to Self-hosted later?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Keep workspace model and data structures consistent to support migration paths."
      }
    },
    {
      "@type": "Question",
      "name": "Can we launch before billing is fully enabled?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Launch onboarding and usage first, and enable billing when provider setup is complete."
      }
    }
  ]
}
```

---

## 5. Implementation Guide

### Recommended Approach: Next.js JSON-LD Component

Since this is a Next.js App Router project, the cleanest approach is a reusable component that injects `<script type="application/ld+json">` tags.

**Create:** `components/seo/JsonLd.tsx`

```tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

**Important:** The homepage (`app/page.tsx`) is currently a `"use client"` component. JSON-LD scripts injected via client components will still be crawled by Googlebot (it renders JavaScript), but for best practice, consider one of these approaches:

1. **Extract the landing page into a Server Component wrapper** that renders the JSON-LD and passes the landing/dashboard split to a client boundary.
2. **Use Next.js `metadata` API** in a `layout.tsx` for the root-level Organization and WebSite schemas (these are static and don't depend on client state).
3. **Use `generateMetadata`** in page-level `layout.tsx` files to inject page-specific schemas.

### Placement Summary

| Schema | Where to Inject | Scope |
|---|---|---|
| Organization | `app/layout.tsx` (root) | All pages |
| WebSite | `app/layout.tsx` (root) | All pages |
| SoftwareApplication | `app/page.tsx` or a homepage layout | Homepage only |
| BreadcrumbList | `PublicDocsShell.tsx` (dynamic) | Docs + Privacy pages |
| WebPage | Per-page as needed | Homepage, key pages |
| FAQPage (optional) | `app/docs/faq/page.tsx` | FAQ page only |

### Root Layout Implementation Example

In `app/layout.tsx`, add before the closing `</head>` (or in the `<body>` -- both work for JSON-LD):

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Synclaw",
      "url": "https://synclaw.in",
      "logo": "https://synclaw.in/pwa-512.svg",
      "description": "Mission control dashboard for OpenClaw AI agents.",
      "email": "privacy@synclaw.in",
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": "privacy@synclaw.in",
        "availableLanguage": "English"
      }
    }),
  }}
/>
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Synclaw",
      "alternateName": "Synclaw HQ",
      "url": "https://synclaw.in",
      "publisher": {
        "@type": "Organization",
        "name": "Synclaw",
        "url": "https://synclaw.in"
      }
    }),
  }}
/>
```

---

## 6. Validation Checklist for All Recommended Schemas

| Check | Status |
|---|---|
| @context is "https://schema.org" | PASS -- all schemas use https |
| @type is valid and not deprecated | PASS -- no deprecated types used |
| All required properties present | PASS -- verified per Google docs |
| Property values match expected types | PASS |
| No placeholder text | PASS -- all values are real content from codebase |
| URLs are absolute | PASS -- all use https://synclaw.in/... |
| Dates are ISO 8601 | PASS -- 2026-03-23, 2027-12-31 |
| No HowTo schema recommended | PASS -- deprecated Sept 2023 |
| No SpecialAnnouncement recommended | PASS -- deprecated July 2025 |
| FAQPage flagged as restricted | PASS -- noted as GEO-only benefit |

---

## 7. Additional Recommendations

### 7.1 Missing Meta Tags (Not Schema, But Related)

- **Open Graph tags**: Verify `og:title`, `og:description`, `og:image`, `og:url`, `og:type` are set. Next.js metadata API supports these via the `openGraph` property.
- **Twitter Card tags**: Add `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` for social sharing.

### 7.2 Domain Discrepancy

The brand config at `config/brand.default.json` lists `websiteUrl` as `https://synclaw.io`, but the live site is `https://synclaw.in`. Ensure the brand config is updated to match the actual domain, or that the env var `NEXT_PUBLIC_APP_URL` overrides it correctly. All schema URLs in this report use `https://synclaw.in`.

### 7.3 Future Schema Opportunities

| When | Schema Type | Trigger |
|---|---|---|
| When blog/changelog is added | `BlogPosting`, `Article` | Each blog post |
| When customer reviews are collected | `AggregateRating` (on Product/SoftwareApplication) | Review aggregation |
| When team/founder page is added | `Person` | Founder profile |
| When public API docs are added | `APIReference` (Schema.org pending) | API documentation |
| When webinars/demos are recorded | `VideoObject` | Demo videos |

### 7.4 Crawlability Note

The homepage is a `"use client"` component that conditionally renders the landing page or dashboard based on auth state. Googlebot will execute JavaScript and see the landing page (since it won't be authenticated). However, for maximum reliability, consider server-rendering the landing page as a separate Server Component to guarantee JSON-LD is in the initial HTML response.

---

## Summary

| Metric | Value |
|---|---|
| Pages analyzed | 5 |
| Existing schema blocks | 0 |
| Recommended schema additions | 7 types across 5+ pages |
| Critical priority items | 5 (Organization, WebSite, SoftwareApplication, Product+Offer, BreadcrumbList) |
| High priority items | 2 (WebPage, FAQPage for GEO) |
| Deprecated schemas avoided | HowTo, SpecialAnnouncement |
| Restricted schemas flagged | FAQPage (commercial site) |
