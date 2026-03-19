# Synclaw Host Agent

`@synclaw/host-agent` runs on each managed runtime host and exposes private APIs for tenant lifecycle:

- `POST /agent/runtime/create`
- `POST /agent/runtime/delete`
- `POST /agent/runtime/restart`
- `GET /agent/runtime/status?workspaceId=...`

It is called only by `managed-gateway` via `/control/tenant/*`.

## Environment

- `MANAGED_HOST_AGENT_SHARED_TOKEN` (required)
- `MANAGED_HOST_UPSTREAM_IP` (required for correct upstream URLs/IP reporting)
- `MANAGED_HOST_AGENT_OPENCLAW_IMAGE` (default: `ghcr.io/openclaw/openclaw:latest`)
- `MANAGED_HOST_AGENT_FS_BRIDGE_IMAGE` (default: `ghcr.io/synclaw/fs-bridge:latest`)
- `MANAGED_UPSTREAM_WS_PORT` (default: `18789`)
- `MANAGED_FILES_BRIDGE_PORT` (default: `8787`)
- `MANAGED_FILES_BRIDGE_ROOT_PATH` (default: `/root/.openclaw`)
- `MANAGED_HOST_AGENT_DOCKER_TIMEOUT_MS` (default: `60000`)
- `PORT` (default: `8790`)

## Security

- Keep this service private (VPC/private network only).
- Protect with strong bearer token (`MANAGED_HOST_AGENT_SHARED_TOKEN`).
- Do not expose `/agent/*` to the public internet.
