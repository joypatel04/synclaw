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
    heroHeadline: BrandString;
    heroSubheadline: BrandString;
    primaryCtaLabel: BrandString;
    secondaryCtaLabel: BrandString;
  };
  auth: {
    loginTitle: BrandString;
    loginSubtitle: BrandString;
    providerLabelGithub: BrandString;
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
  ["auth", "loginTitle"],
  ["auth", "loginSubtitle"],
  ["auth", "providerLabelGithub"],
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
}

export function resolveBrandConfig(): BrandConfig {
  const base = defaultBrand as BrandConfig;
  const override = parseEnvOverride(process.env.NEXT_PUBLIC_BRAND_CONFIG_JSON);
  const merged = applyLegacyFallbacks(mergeBrand(base, override));
  assertValid(merged);
  return merged;
}

export const brand = resolveBrandConfig();

