/** Region = Hostinger datacenter id from listHostingerDatacenters (e.g. lt, de, uk, us). */
export type ManagedRegionCode = string;

/** Fallback when Hostinger API returns no datacenters (e.g. token not set). */
export const MANAGED_REGION_OPTIONS: Array<{
  code: ManagedRegionCode;
  label: string;
  hint?: string;
}> = [];

export function managedRegionLabel(
  code?: string | null,
  extraOptions?: Array<{ code: string; label: string }>,
): string {
  if (!code) return "Not selected";
  const fromExtra = extraOptions?.find((r) => r.code === code)?.label;
  if (fromExtra) return fromExtra;
  return code;
}
