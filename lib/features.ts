import { canUseCapability } from "@/lib/edition";

function parseBooleanEnv(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return defaultValue;
}

export const BILLING_ENABLED =
  parseBooleanEnv(process.env.NEXT_PUBLIC_BILLING_ENABLED, false) &&
  canUseCapability("billing");

export const MANAGED_BETA_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_MANAGED_BETA_ENABLED,
  false,
);

export const MANAGED_INTERNAL_CONTROLS_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_MANAGED_INTERNAL_CONTROLS_ENABLED,
  process.env.NODE_ENV !== "production",
);

export const ASSISTED_LAUNCH_BETA_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_ASSISTED_LAUNCH_BETA_ENABLED,
  false,
);

export const WEBHOOKS_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_WEBHOOKS_ENABLED,
  true,
);

export const OPENCLAW_FILES_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_OPENCLAW_FILES_ENABLED,
  false,
);

export const AGENT_SETUP_ADVANCED_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_AGENT_SETUP_ADVANCED_ENABLED,
  process.env.NODE_ENV !== "production",
);
