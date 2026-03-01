export type ManagedServerProfileCode = "starter" | "standard" | "performance";

export type ManagedServerProfile = {
  code: ManagedServerProfileCode;
  label: string;
  description: string;
  serverType: string;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  storageType: "NVMe";
  costTier: "low" | "medium" | "high";
};

export const MANAGED_SERVER_PROFILES: ManagedServerProfile[] = [
  {
    code: "starter",
    label: "Starter",
    description: "Lowest-cost option for testing and small workloads.",
    serverType: "cax11",
    vcpu: 2,
    ramGb: 4,
    storageGb: 40,
    storageType: "NVMe",
    costTier: "low",
  },
  {
    code: "standard",
    label: "Standard",
    description: "Balanced resources for steady production usage.",
    serverType: "cpx32",
    vcpu: 4,
    ramGb: 8,
    storageGb: 160,
    storageType: "NVMe",
    costTier: "medium",
  },
  {
    code: "performance",
    label: "Performance",
    description: "Higher headroom for heavier automation and traffic.",
    serverType: "cpx42",
    vcpu: 8,
    ramGb: 16,
    storageGb: 320,
    storageType: "NVMe",
    costTier: "high",
  },
];

export const DEFAULT_MANAGED_SERVER_PROFILE: ManagedServerProfileCode =
  "starter";

export function managedServerProfileByCode(
  code?: string | null,
): ManagedServerProfile {
  return (
    MANAGED_SERVER_PROFILES.find((profile) => profile.code === code) ??
    MANAGED_SERVER_PROFILES.find(
      (profile) => profile.code === DEFAULT_MANAGED_SERVER_PROFILE,
    )!
  );
}
