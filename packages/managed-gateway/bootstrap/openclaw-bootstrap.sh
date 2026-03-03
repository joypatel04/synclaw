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
OPENCLAW_USER="openclaw"
OPENCLAW_GROUP="openclaw"
OPENCLAW_STATE_DIR="/var/lib/openclaw"
OPENCLAW_ETC_DIR="/etc/openclaw"
OPENCLAW_ENV_FILE="${OPENCLAW_ETC_DIR}/managed.env"
OPENCLAW_UNIT_FILE="/etc/systemd/system/openclaw-gateway.service"

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
apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release ufw

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
  useradd --system --gid "${OPENCLAW_GROUP}" --home "${OPENCLAW_STATE_DIR}" --shell /usr/sbin/nologin "${OPENCLAW_USER}"
fi

install -d -m 0750 -o "${OPENCLAW_USER}" -g "${OPENCLAW_GROUP}" "${OPENCLAW_STATE_DIR}"
install -d -m 0750 -o root -g "${OPENCLAW_GROUP}" "${OPENCLAW_ETC_DIR}"

cat > "${OPENCLAW_ENV_FILE}" <<EOF
OPENCLAW_GATEWAY_PORT=${OPENCLAW_PORT}
OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_TOKEN}
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_STATE_DIR=${OPENCLAW_STATE_DIR}
OPENCLAW_CONFIG_PATH=${OPENCLAW_STATE_DIR}/openclaw.json
OPENCLAW_WORKSPACE_ID=${WORKSPACE_ID}
OPENCLAW_MANAGED_REGION=${REGION}
OPENCLAW_MANAGED_INSTANCE_ID=${INSTANCE_ID}
EOF
chmod 0640 "${OPENCLAW_ENV_FILE}"
chown root:"${OPENCLAW_GROUP}" "${OPENCLAW_ENV_FILE}"

OPENCLAW_BIN="$(command -v openclaw)"
if [[ -z "${OPENCLAW_BIN}" ]]; then
  echo "openclaw binary not found after installation." >&2
  exit 1
fi

cat > "${OPENCLAW_UNIT_FILE}" <<'UNIT'
[Unit]
Description=OpenClaw Gateway (managed)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=openclaw
Group=openclaw
EnvironmentFile=/etc/openclaw/managed.env
WorkingDirectory=/var/lib/openclaw
ExecStart=/usr/local/bin/openclaw gateway --port ${OPENCLAW_GATEWAY_PORT} --bind ${OPENCLAW_GATEWAY_BIND} --auth token --token ${OPENCLAW_GATEWAY_TOKEN} --allow-unconfigured
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/openclaw
LockPersonality=true
RestrictRealtime=true

[Install]
WantedBy=multi-user.target
UNIT

# Adjust binary path if npm installs elsewhere.
if [[ "${OPENCLAW_BIN}" != "/usr/local/bin/openclaw" ]]; then
  sed -i "s|/usr/local/bin/openclaw|${OPENCLAW_BIN}|g" "${OPENCLAW_UNIT_FILE}"
fi

systemctl daemon-reload
systemctl enable --now openclaw-gateway.service

# Firewall-safe exposure:
# - deny the OpenClaw port generally
# - allow only the current SSH client IP (managed-gateway host) to that port
SSH_CLIENT_IP="$(awk '{print $1}' <<< "${SSH_CONNECTION:-}")"
if [[ -n "${SSH_CLIENT_IP}" ]]; then
  # Keep SSH access safe even after enabling UFW.
  ufw --force allow OpenSSH >/dev/null 2>&1 || true
  ufw --force allow proto tcp from "${SSH_CLIENT_IP}" to any port "${OPENCLAW_PORT}" >/dev/null 2>&1 || true
  ufw --force deny proto tcp to any port "${OPENCLAW_PORT}" >/dev/null 2>&1 || true
else
  echo "Warning: SSH_CONNECTION missing; skipped gateway-IP firewall allow rule." >&2
fi

if ! ufw status | grep -q "Status: active"; then
  ufw --force enable
fi

# Service verification.
systemctl is-active --quiet openclaw-gateway.service
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
  systemctl status openclaw-gateway.service --no-pager >&2 || true
  journalctl -u openclaw-gateway.service -n 120 --no-pager >&2 || true
  exit 1
fi

echo "OpenClaw managed bootstrap complete for workspace ${WORKSPACE_ID} on port ${OPENCLAW_PORT}."
