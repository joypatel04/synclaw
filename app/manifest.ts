import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.product.name,
    short_name: brand.product.name,
    description: brand.seo.descriptionDefault,
    start_url: "/",
    display: "standalone",
    background_color: "#0b1020",
    theme_color: "#0f172a",
    orientation: "portrait",
    icons: [
      {
        src: "/pwa-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/pwa-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
