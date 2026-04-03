import type { MetadataRoute } from "next";

const BASE = "https://synclaw.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Static public pages.
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    {
      url: `${BASE}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Documentation pages.
  const docPaths = [
    "/docs",
    "/docs/faq",
    "/docs/pricing",
    "/docs/public-wss",
    "/docs/self-hosted",
    "/docs/hosting",
    "/docs/hosting/public-wss",
    "/docs/hosting/environment",
    "/docs/hosting/troubleshooting",
    "/docs/hosting/webhooks",
    "/docs/hosting/webhooks/security",
    "/docs/hosting/webhooks/providers",
    "/docs/hosting/self-hosted",
    "/docs/hosting/self-hosted/convex",
    "/docs/hosting/self-hosted/files-bridge",
    "/docs/hosting/self-hosted/mcp",
  ];

  const docPages: MetadataRoute.Sitemap = docPaths.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Help pages.
  const helpPaths = [
    "/help",
    "/help/getting-started",
    "/help/agent-setup",
    "/help/public-wss",
    "/help/self-hosted",
    "/help/faq",
    "/help/pricing",
  ];

  const helpPages: MetadataRoute.Sitemap = helpPaths.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...docPages, ...helpPages];
}
