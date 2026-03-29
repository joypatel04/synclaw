export type Edition = "core" | "commercial";

export type CommercialCapability =
  | "managedProvisioning"
  | "assistedLaunch"
  | "prioritySupport"
  | "managedGatewayAutomation";

const CAPABILITY_MATRIX: Record<Edition, Record<CommercialCapability, boolean>> = {
  core: {
    managedProvisioning: false,
    assistedLaunch: false,
    prioritySupport: false,
    managedGatewayAutomation: false,
  },
  commercial: {
    managedProvisioning: true,
    assistedLaunch: true,
    prioritySupport: true,
    managedGatewayAutomation: true,
  },
};

function normalizeEdition(raw?: string | null): Edition {
  return raw?.trim().toLowerCase() === "core" ? "core" : "commercial";
}

export function getServerEdition(): Edition {
  return normalizeEdition(process.env.SYNCLAW_EDITION);
}

export function getClientEdition(): Edition {
  return normalizeEdition(process.env.NEXT_PUBLIC_SYNCLAW_EDITION);
}

export function canUseCapability(
  capability: CommercialCapability,
  edition: Edition = getClientEdition(),
): boolean {
  return CAPABILITY_MATRIX[edition][capability];
}

export function canUseServerCapability(
  capability: CommercialCapability,
  edition: Edition = getServerEdition(),
): boolean {
  return CAPABILITY_MATRIX[edition][capability];
}

export function editionCapabilitySnapshot(
  edition: Edition = getServerEdition(),
): Record<CommercialCapability, boolean> {
  return CAPABILITY_MATRIX[edition];
}
