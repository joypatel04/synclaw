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

export const BILLING_ENABLED = parseBooleanEnv(
  process.env.NEXT_PUBLIC_BILLING_ENABLED,
  false,
);

