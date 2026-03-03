#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="${1:-$ROOT_DIR/dist/oss-beta}"

mkdir -p "$DEST_DIR"

rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".next" \
  --exclude "dist" \
  --exclude "*.tsbuildinfo" \
  "$ROOT_DIR/" "$DEST_DIR/"

# Remove commercial-only operational assets/docs from exported OSS bundle.
rm -rf \
  "$DEST_DIR/packages/managed-gateway" \
  "$DEST_DIR/packages/commercial" \
  "$DEST_DIR/docs/commercial"

# Keep governance minimal in OSS export.
rm -f "$DEST_DIR/.github/workflows/edition-governance.yml"

ENV_FILE="$DEST_DIR/.env.local.example"
if [ -f "$ENV_FILE" ]; then
  perl -0pi -e 's/^SYNCLAW_EDITION=.*$/SYNCLAW_EDITION=core/m' "$ENV_FILE"
  perl -0pi -e 's/^NEXT_PUBLIC_SYNCLAW_EDITION=.*$/NEXT_PUBLIC_SYNCLAW_EDITION=core/m' "$ENV_FILE"
  perl -0pi -e 's/^SYNCLAW_MANAGED_BETA_ENABLED=.*$/SYNCLAW_MANAGED_BETA_ENABLED=false/m' "$ENV_FILE"
  perl -0pi -e 's/^SYNCLAW_ASSISTED_LAUNCH_ENABLED=.*$/SYNCLAW_ASSISTED_LAUNCH_ENABLED=false/m' "$ENV_FILE"
  perl -0pi -e 's/^NEXT_PUBLIC_MANAGED_BETA_ENABLED=.*$/NEXT_PUBLIC_MANAGED_BETA_ENABLED=false/m' "$ENV_FILE"
  perl -0pi -e 's/^NEXT_PUBLIC_ASSISTED_LAUNCH_BETA_ENABLED=.*$/NEXT_PUBLIC_ASSISTED_LAUNCH_BETA_ENABLED=false/m' "$ENV_FILE"
  perl -0pi -e 's/^NEXT_PUBLIC_BILLING_ENABLED=.*$/NEXT_PUBLIC_BILLING_ENABLED=false/m' "$ENV_FILE"
fi

cat <<MSG
OSS beta export ready at: $DEST_DIR

Default launch profile in exported .env.local.example:
- SYNCLAW_EDITION=core
- Managed/assisted disabled
- Billing UI disabled

Note: runtime capability guards remain in source to keep one maintainable codebase.
MSG
