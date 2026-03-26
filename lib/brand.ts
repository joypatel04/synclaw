import defaultBrand from "@/config/brand.default.json";

type BrandString = string;

export interface BrandConfig {
  product: {
    name: BrandString;
    tagline: BrandString;
    shortName: BrandString;
    websiteUrl: BrandString;
  };
  marketing: {
    landingNavLinks?: Array<{
      label: BrandString;
      href: BrandString;
    }>;
    heroPrimaryCtaLabel?: BrandString;
    heroSecondaryCtaLabel?: BrandString;
    heroEyebrow?: BrandString;
    proofGridItems?: Array<{
      title: BrandString;
      body: BrandString;
      footnote?: BrandString;
    }>;
    explainerBlocks?: Array<{
      title: BrandString;
      body: BrandString;
      chips: BrandString[];
    }>;
    useCaseCards?: Array<{
      title: BrandString;
      body: BrandString;
      tag: BrandString;
    }>;
    finalCtaLabel?: BrandString;
    heroHeadline: BrandString;
    heroSubheadline: BrandString;
    primaryCtaLabel: BrandString;
    secondaryCtaLabel: BrandString;
    signInLabel: BrandString;
    trustBadge: BrandString;
    heroAccent: BrandString;
    benefitBullets: BrandString[];
    snapshotTitle: BrandString;
    snapshotLiveLabel: BrandString;
    snapshotRows: Array<{
      label: BrandString;
      value: BrandString;
    }>;
    snapshotNoteTitle: BrandString;
    snapshotNoteBody: BrandString;
    proofStrip: Array<{
      label: BrandString;
      value: BrandString;
    }>;
    productInActionTitle: BrandString;
    productInActionSubtitle: BrandString;
    visualCards: Array<{
      title: BrandString;
      caption: BrandString;
    }>;
    howItWorksTitle: BrandString;
    operatorFlowTitle: BrandString;
    operatorFlowBody: BrandString;
    creativeTitle: BrandString;
    whyKicker: BrandString;
    whyHeadline: BrandString;
    whyBody: BrandString;
    whyBullets: BrandString[];
    segmentCards: Array<{
      title: BrandString;
      text: BrandString;
    }>;
    pricingKicker: BrandString;
    pricingHeadline: BrandString;
    pricingCtaLabel: BrandString;
    trialTitle: BrandString;
    trialSummary: BrandString;
    starterSummary: BrandString;
    proSummary: BrandString;
    finalCtaKicker: BrandString;
    finalCtaHeadline: BrandString;
    finalCtaBody: BrandString;
    exploreDocsLabel: BrandString;
  };
  auth: {
    loginTitle: BrandString;
    loginSubtitle: BrandString;
    providerLabelGithub: BrandString;
    providerLabelGoogle: BrandString;
    footerNote: BrandString;
  };
  seo: {
    titleDefault: BrandString;
    descriptionDefault: BrandString;
  };
}

type BrandOverride = Partial<{
  [K in keyof BrandConfig]: Partial<BrandConfig[K]>;
}>;

const REQUIRED_PATHS: Array<[keyof BrandConfig, string]> = [
  ["product", "name"],
  ["product", "tagline"],
  ["product", "shortName"],
  ["product", "websiteUrl"],
  ["marketing", "heroHeadline"],
  ["marketing", "heroSubheadline"],
  ["marketing", "primaryCtaLabel"],
  ["marketing", "secondaryCtaLabel"],
  ["marketing", "signInLabel"],
  ["marketing", "trustBadge"],
  ["marketing", "heroAccent"],
  ["marketing", "snapshotTitle"],
  ["marketing", "snapshotLiveLabel"],
  ["marketing", "snapshotNoteTitle"],
  ["marketing", "snapshotNoteBody"],
  ["marketing", "productInActionTitle"],
  ["marketing", "productInActionSubtitle"],
  ["marketing", "howItWorksTitle"],
  ["marketing", "operatorFlowTitle"],
  ["marketing", "operatorFlowBody"],
  ["marketing", "creativeTitle"],
  ["marketing", "whyKicker"],
  ["marketing", "whyHeadline"],
  ["marketing", "whyBody"],
  ["marketing", "pricingKicker"],
  ["marketing", "pricingHeadline"],
  ["marketing", "pricingCtaLabel"],
  ["marketing", "trialTitle"],
  ["marketing", "trialSummary"],
  ["marketing", "starterSummary"],
  ["marketing", "proSummary"],
  ["marketing", "finalCtaKicker"],
  ["marketing", "finalCtaHeadline"],
  ["marketing", "finalCtaBody"],
  ["marketing", "exploreDocsLabel"],
  ["auth", "loginTitle"],
  ["auth", "loginSubtitle"],
  ["auth", "providerLabelGithub"],
  ["auth", "providerLabelGoogle"],
  ["auth", "footerNote"],
  ["seo", "titleDefault"],
  ["seo", "descriptionDefault"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseEnvOverride(raw: string | undefined): BrandOverride {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return parsed as BrandOverride;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // Keep app running with defaults if env override JSON is malformed.
      console.warn("[brand] Invalid NEXT_PUBLIC_BRAND_CONFIG_JSON", error);
    }
    return {};
  }
}

function mergeBrand(base: BrandConfig, override: BrandOverride): BrandConfig {
  return {
    product: { ...base.product, ...(override.product ?? {}) },
    marketing: { ...base.marketing, ...(override.marketing ?? {}) },
    auth: { ...base.auth, ...(override.auth ?? {}) },
    seo: { ...base.seo, ...(override.seo ?? {}) },
  };
}

function applyLegacyFallbacks(config: BrandConfig): BrandConfig {
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  return {
    ...config,
    product: {
      ...config.product,
      name: appName || config.product.name,
      websiteUrl: appUrl || config.product.websiteUrl,
    },
    seo: {
      ...config.seo,
      titleDefault: appName || config.seo.titleDefault,
    },
    auth: {
      ...config.auth,
      loginTitle: appName || config.auth.loginTitle,
    },
  };
}

function assertValid(config: BrandConfig): void {
  const missing = REQUIRED_PATHS.filter(([section, key]) => {
    const value = (config[section] as Record<string, unknown>)[key];
    return typeof value !== "string" || value.trim().length === 0;
  }).map(([section, key]) => `${String(section)}.${key}`);

  if (missing.length > 0) {
    throw new Error(
      `[brand] Missing required brand keys: ${missing.join(", ")}`,
    );
  }

  if (config.marketing.benefitBullets.length === 0) {
    throw new Error(
      "[brand] marketing.benefitBullets must contain at least one item",
    );
  }

  if (config.marketing.snapshotRows.length === 0) {
    throw new Error(
      "[brand] marketing.snapshotRows must contain at least one row",
    );
  }

  if (config.marketing.segmentCards.length === 0) {
    throw new Error(
      "[brand] marketing.segmentCards must contain at least one card",
    );
  }

  if (config.marketing.proofStrip.length === 0) {
    throw new Error(
      "[brand] marketing.proofStrip must contain at least one item",
    );
  }

  if (config.marketing.visualCards.length === 0) {
    throw new Error(
      "[brand] marketing.visualCards must contain at least one card",
    );
  }

  if (config.marketing.whyBullets.length === 0) {
    throw new Error(
      "[brand] marketing.whyBullets must contain at least one bullet",
    );
  }
}

export function resolveBrandConfig(): BrandConfig {
  const base = defaultBrand as BrandConfig;
  const override = parseEnvOverride(process.env.NEXT_PUBLIC_BRAND_CONFIG_JSON);
  const merged = applyLegacyFallbacks(mergeBrand(base, override));
  assertValid(merged);
  return merged;
}

export const brand = resolveBrandConfig();
