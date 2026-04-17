#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

echo "==> Pulling latest code"
git -C "$REPO_ROOT" pull

echo "==> Stopping existing synclaw-fs-bridge containers (if any)"
running_ids="$(docker ps --filter "ancestor=synclaw-fs-bridge" --format "{{.ID}}")"
if [[ -n "$running_ids" ]]; then
  # shellcheck disable=SC2086
  docker stop $running_ids
else
  echo "No running containers found for image synclaw-fs-bridge"
fi

echo "==> Building synclaw-fs-bridge image"
cd "$SCRIPT_DIR"
docker build -t synclaw-fs-bridge .

echo "==> Starting synclaw-fs-bridge container"
docker run --rm -p 8787:8787 \
  -e FS_BRIDGE_TOKEN="12913f8f2722c7088503004a3f13f18a41e63f2d9e7c11308abeceb02dce7d71" \
  -e WORKSPACE_ROOT_PATH="$HOME/.openclaw" \
  -e FS_MAX_FILE_BYTES="1048576" \
  -e FS_ALLOWED_EXTENSIONS=".md,.txt,.json,.yaml,.yml,.toml,.config,.js,.jsx,.mjs,.ts,.tsx" \
  -e FS_ALLOWED_BINARY_READ_EXTENSIONS=".pdf" \
  -v "$HOME/.openclaw:$HOME/.openclaw" \
  synclaw-fs-bridge
