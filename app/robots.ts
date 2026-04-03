import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs/", "/help/", "/privacy"],
        disallow: [
          "/settings/",
          "/chat/",
          "/agents/",
          "/tasks/",
          "/broadcasts/",
          "/documents/",
          "/filesystem/",
          "/onboarding/",
          "/admin/",
          "/super-admin/",
          "/login",
          "/v2",
          "/v3",
        ],
      },
      // Block AI training crawlers (not search crawlers).
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
    ],
    sitemap: "https://synclaw.in/sitemap.xml",
  };
}
