import type { BrandConfig } from "@/lib/brand";
import { resolveLandingContent } from "./content";
import { LandingShell } from "./LandingShell";

export function LandingPageV1({ brand }: { brand: BrandConfig }) {
  const content = resolveLandingContent(brand);
  return <LandingShell brand={brand} content={content} />;
}
