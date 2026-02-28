export type ManagedRegionCode = "eu_central_hil" | "eu_central_nbg";

export const MANAGED_REGION_OPTIONS: Array<{
  code: ManagedRegionCode;
  label: string;
  hint?: string;
}> = [
  {
    code: "eu_central_hil",
    label: "EU Central (Helsinki)",
    hint: "Lower-cost test region",
  },
  {
    code: "eu_central_nbg",
    label: "EU Central (Nuremberg)",
    hint: "Lower-cost test region",
  },
];

export function managedRegionLabel(code?: string | null): string {
  if (!code) return "Not selected";
  return MANAGED_REGION_OPTIONS.find((r) => r.code === code)?.label ?? code;
}
