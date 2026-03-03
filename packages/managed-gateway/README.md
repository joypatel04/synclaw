# Synclaw Managed Gateway

Single-domain managed control plane + WebSocket gateway for path-based workspace routing.

## Endpoints

- `GET /control/health`
- `POST /control/bootstrap`
- `POST /control/openclaw/provider/apply`
- `POST /control/openclaw/provider/verify`
- `POST /control/routes`
- `POST /control/routes/delete`
- `GET /control/routes/verify?workspaceId=...`
- WebSocket: `GET /ws/:workspaceId`

## Local Run

```bash
cd packages/managed-gateway
cp .env.example .env
# edit .env (set MANAGED_GATEWAY_API_TOKEN at minimum)
npm install
npm run build
npm start
```

## Required env

- `MANAGED_GATEWAY_API_TOKEN`

## Important env

- `MANAGED_GATEWAY_DB_PATH` (default: `/var/lib/managed-gateway/routes.db`)
- `WORKSPACE_WS_PATH_PREFIX` (default: `/ws`)
- `MANAGED_UPSTREAM_WS_SCHEME` (default: `ws`)
- `MANAGED_UPSTREAM_WS_PORT` (default: `18789`)
- `MANAGED_UPSTREAM_WS_PATH` (default: `/`)
- `MANAGED_BOOTSTRAP_TIMEOUT_MS`
- `MANAGED_HEALTHCHECK_TIMEOUT_MS`
- `MANAGED_REQUIRE_CUSTOM_BOOTSTRAP_SCRIPT` (default: `true`)
- `MANAGED_BOOTSTRAP_SCRIPT` (required in real mode; custom SSH bootstrap script)
- `MANAGED_BOOTSTRAP_SCRIPT_FILE` (optional path to script file on VM)
- `MANAGED_FILES_BRIDGE_PORT` (default: `8787`)
- `MANAGED_FILES_BRIDGE_ROOT_PATH` (default: `/root/.openclaw`)

## Real OpenClaw Bootstrap Script

`/control/bootstrap` now expects `MANAGED_BOOTSTRAP_SCRIPT` in real mode and injects:

- `{{WORKSPACE_ID}}`
- `{{JOB_ID}}`
- `{{INSTANCE_ID}}`
- `{{HOST}}`
- `{{REGION}}`
- `{{UPSTREAM_PORT}}`
- `{{OPENCLAW_GATEWAY_TOKEN}}`
- `{{FILES_BRIDGE_TOKEN}}`
- `{{FILES_BRIDGE_PORT}}`
- `{{FILES_BRIDGE_ROOT_PATH}}`

Example shape:

```bash
set -euo pipefail
apt-get update -y
apt-get install -y curl ca-certificates

# install OpenClaw CLI/runtime here
# ...

mkdir -p /etc/openclaw
cat > /etc/openclaw/managed.env <<EOF
OPENCLAW_GATEWAY_TOKEN={{OPENCLAW_GATEWAY_TOKEN}}
OPENCLAW_GATEWAY_PORT={{UPSTREAM_PORT}}
EOF

# run OpenClaw as a systemd service (replace with your production command)
# ExecStart should bind to 0.0.0.0:${OPENCLAW_GATEWAY_PORT} (or tailnet IP)
```

If you prefer a file-based script:

1. Save the script on VM, for example `/opt/managed-gateway/bootstrap/openclaw-bootstrap.sh`.
2. Set `MANAGED_BOOTSTRAP_SCRIPT_FILE=/opt/managed-gateway/bootstrap/openclaw-bootstrap.sh`.

This repo includes a hardened template at:
- `/Users/joypatel/sutraha-hq/packages/managed-gateway/bootstrap/openclaw-bootstrap.sh`

## Deployment

Use `docker-compose.yml` in this folder on your Hetzner VM.

Recommended:

```bash
cp .env.example .env
# edit .env
docker compose up -d --build
```

Important:
- Do not proxy catch-all traffic back to the same gateway domain (proxy loop risk).
- Keep this gateway domain dedicated to `/control/*` and `/ws/*`.
- If you need same-domain frontend routing later, point fallback to a different upstream host (for example your Vercel app domain), never to itself.
