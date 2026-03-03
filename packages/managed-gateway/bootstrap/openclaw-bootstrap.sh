#!/usr/bin/env bash
set -euo pipefail

# Managed OpenClaw bootstrap script (idempotent).
# Rendered by managed-gateway /control/bootstrap with placeholders:
# {{WORKSPACE_ID}} {{JOB_ID}} {{INSTANCE_ID}} {{HOST}} {{REGION}}
# {{UPSTREAM_PORT}} {{OPENCLAW_GATEWAY_TOKEN}}

WORKSPACE_ID="{{WORKSPACE_ID}}"
JOB_ID="{{JOB_ID}}"
INSTANCE_ID="{{INSTANCE_ID}}"
REGION="{{REGION}}"
OPENCLAW_PORT="{{UPSTREAM_PORT}}"
OPENCLAW_TOKEN="{{OPENCLAW_GATEWAY_TOKEN}}"
CONTROL_UI_ALLOWED_ORIGINS_JSON='{{CONTROL_UI_ALLOWED_ORIGINS_JSON}}'
OPENCLAW_USER="openclaw"
OPENCLAW_GROUP="openclaw"
OPENCLAW_STATE_DIR="/var/lib/openclaw"
OPENCLAW_HOME_DIR="/root"
OPENCLAW_ETC_DIR="/etc/openclaw"
OPENCLAW_ENV_FILE="${OPENCLAW_ETC_DIR}/managed.env"
OPENCLAW_PROVIDERS_ENV_FILE="${OPENCLAW_ETC_DIR}/providers.env"
OPENCLAW_GATEWAY_UNIT="openclaw-gateway.service"
OPENCLAW_CONFIG_DIR="${OPENCLAW_HOME_DIR}/.openclaw"
OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_DIR}/openclaw.json"

if [[ -z "${OPENCLAW_TOKEN}" ]]; then
  echo "OPENCLAW gateway token is empty; refusing bootstrap." >&2
  exit 1
fi

if [[ -z "${OPENCLAW_PORT}" ]]; then
  echo "OPENCLAW gateway port is empty; refusing bootstrap." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release

# Node 22+ is required by OpenClaw docs.
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//;s/\..*$//')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Install or update OpenClaw CLI.
npm install -g openclaw@latest

# System user/group for least-privilege runtime.
if ! getent group "${OPENCLAW_GROUP}" >/dev/null 2>&1; then
  groupadd --system "${OPENCLAW_GROUP}"
fi
if ! id -u "${OPENCLAW_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${OPENCLAW_GROUP}" --home "${OPENCLAW_STATE_DIR}" --shell /bin/bash "${OPENCLAW_USER}"
fi

install -d -m 0750 -o "${OPENCLAW_USER}" -g "${OPENCLAW_GROUP}" "${OPENCLAW_STATE_DIR}"
install -d -m 0750 -o root -g "${OPENCLAW_GROUP}" "${OPENCLAW_ETC_DIR}"
install -d -m 0700 -o root -g root "${OPENCLAW_CONFIG_DIR}"

cat > "${OPENCLAW_ENV_FILE}" <<EOF
OPENCLAW_GATEWAY_PORT=${OPENCLAW_PORT}
OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_TOKEN}
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_STATE_DIR=${OPENCLAW_STATE_DIR}
OPENCLAW_WORKSPACE_ID=${WORKSPACE_ID}
OPENCLAW_MANAGED_REGION=${REGION}
OPENCLAW_MANAGED_INSTANCE_ID=${INSTANCE_ID}
EOF
chmod 0640 "${OPENCLAW_ENV_FILE}"
chown root:"${OPENCLAW_GROUP}" "${OPENCLAW_ENV_FILE}"
touch "${OPENCLAW_PROVIDERS_ENV_FILE}"
chmod 0600 "${OPENCLAW_PROVIDERS_ENV_FILE}"
chown root:root "${OPENCLAW_PROVIDERS_ENV_FILE}"

OPENCLAW_BIN="$(command -v openclaw)"
if [[ -z "${OPENCLAW_BIN}" ]]; then
  echo "openclaw binary not found after installation." >&2
  exit 1
fi

# Ensure OpenClaw runtime config exists in the default root profile.
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" gateway run --help >/dev/null 2>&1

# Pre-create session store dirs so doctor/setup checks don't block on prompts.
install -d -m 0700 -o root -g root "${OPENCLAW_HOME_DIR}/.openclaw/agents/main/sessions"

# Configure core gateway settings via OpenClaw CLI (stable contract).
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.mode local
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.port "${OPENCLAW_PORT}"
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.bind lan
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.auth.mode token
HOME="${OPENCLAW_HOME_DIR}" "${OPENCLAW_BIN}" config set gateway.auth.token "${OPENCLAW_TOKEN}"

# Ensure managed defaults and control UI origins are set in config.
HOME="${OPENCLAW_HOME_DIR}" node <<NODE
const fs = require("node:fs");
const path = "${OPENCLAW_CONFIG_PATH}";
let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(path, "utf8"));
} catch {
  cfg = {};
}
cfg.gateway = cfg.gateway || {};
cfg.gateway.controlUi = cfg.gateway.controlUi || {};
cfg.gateway.controlUi.allowedOrigins = ${CONTROL_UI_ALLOWED_ORIGINS_JSON};
cfg.agents = cfg.agents || {};
cfg.agents.defaults = cfg.agents.defaults || {};
cfg.agents.defaults.model = cfg.agents.defaults.model || {};
fs.mkdirSync("${OPENCLAW_CONFIG_DIR}", { recursive: true });
fs.writeFileSync(path, JSON.stringify(cfg, null, 2), "utf8");
NODE

# Create a deterministic systemd service for managed mode.
cat > "/etc/systemd/system/${OPENCLAW_GATEWAY_UNIT}" <<EOF
[Unit]
Description=OpenClaw Gateway (managed)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${OPENCLAW_HOME_DIR}
EnvironmentFile=${OPENCLAW_ENV_FILE}
EnvironmentFile=-${OPENCLAW_PROVIDERS_ENV_FILE}
ExecStart=${OPENCLAW_BIN} gateway run --allow-unconfigured --port \${OPENCLAW_GATEWAY_PORT} --bind \${OPENCLAW_GATEWAY_BIND} --auth token --token \${OPENCLAW_GATEWAY_TOKEN}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${OPENCLAW_GATEWAY_UNIT}"

# Service verification.
systemctl is-active --quiet "${OPENCLAW_GATEWAY_UNIT}"
# Give gateway process time to initialize and bind.
BOUND=0
for _ in $(seq 1 60); do
  if ss -ltn | grep -q ":${OPENCLAW_PORT}\\b"; then
    BOUND=1
    break
  fi
  sleep 2
done

if [[ "${BOUND}" -ne 1 ]]; then
  echo "OpenClaw service started but port ${OPENCLAW_PORT} is not listening." >&2
  systemctl status "${OPENCLAW_GATEWAY_UNIT}" --no-pager >&2 || true
  journalctl -u "${OPENCLAW_GATEWAY_UNIT}" -n 120 --no-pager >&2 || true
  exit 1
fi

echo "OpenClaw managed bootstrap complete for workspace ${WORKSPACE_ID} on port ${OPENCLAW_PORT}."
