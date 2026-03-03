import {
  canUseServerCapability,
  getServerEdition,
  type CommercialCapability,
} from "../../lib/edition";

export const FEATURE_NOT_AVAILABLE_IN_CORE_EDITION =
  "FEATURE_NOT_AVAILABLE_IN_CORE_EDITION";
export const FEATURE_DISABLED_BY_LAUNCH_STAGE =
  "FEATURE_DISABLED_BY_LAUNCH_STAGE";

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

function isCapabilityEnabledForLaunchStage(
  capability: CommercialCapability,
): boolean {
  if (
    capability === "managedProvisioning" ||
    capability === "managedGatewayAutomation"
  ) {
    return parseBooleanEnv(process.env.SYNCLAW_MANAGED_BETA_ENABLED, false);
  }
  if (capability === "assistedLaunch" || capability === "prioritySupport") {
    return parseBooleanEnv(process.env.SYNCLAW_ASSISTED_LAUNCH_ENABLED, false);
  }
  return true;
}

export function requireCapability(capability: CommercialCapability): void {
  if (canUseServerCapability(capability)) return;
  const edition = getServerEdition();
  throw new Error(
    `${FEATURE_NOT_AVAILABLE_IN_CORE_EDITION}: capability=${capability} edition=${edition}`,
  );
}

export function isCommercialCapabilityEnabled(
  capability: CommercialCapability,
): boolean {
  return (
    canUseServerCapability(capability) &&
    isCapabilityEnabledForLaunchStage(capability)
  );
}

export function requireEnabledCapability(capability: CommercialCapability): void {
  requireCapability(capability);
  if (isCapabilityEnabledForLaunchStage(capability)) return;
  throw new Error(
    `${FEATURE_DISABLED_BY_LAUNCH_STAGE}: capability=${capability}`,
  );
}
