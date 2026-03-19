# Managed OpenClaw v2 (Container Pool) - Quick Start

This enables shared runtime hosts with per-workspace tenant containers.

## 1) Convex env

Set:

- `MANAGED_RUNTIME_MODE=container_pool`
- `MANAGED_CONTROL_PLANE_BASE_URL=https://managed.synclaw.in/control` (or your control path)
- `MANAGED_GATEWAY_API_TOKEN=<shared control token>`
- `MANAGED_HOST_AGENT_SHARED_TOKEN=<shared host-agent token>`
- `MANAGED_UPSTREAM_WS_PORT=18789`
- `MANAGED_FILES_BRIDGE_PORT=8787`

## 2) Gateway VM env (`packages/managed-gateway/.env`)

Set:

- `MANAGED_GATEWAY_API_TOKEN=<same token as Convex>`
- `MANAGED_HOST_AGENT_SHARED_TOKEN=<same host-agent token>`
- `MANAGED_HOST_POOL_MAX_UTILIZATION=0.75`
- `MANAGED_HOST_AGENT_TIMEOUT_MS=45000`

Then deploy:

```bash
cd packages/managed-gateway
docker compose up -d --build
```

## 3) Runtime host setup (DigitalOcean droplet)

Install Docker, then run `packages/host-agent`.

Required host-agent env:

- `MANAGED_HOST_AGENT_SHARED_TOKEN=<same token as gateway>`
- `MANAGED_HOST_UPSTREAM_IP=<this host private/public IP reachable by gateway>`
- `MANAGED_HOST_AGENT_OPENCLAW_IMAGE=<openclaw image>`
- `MANAGED_HOST_AGENT_FS_BRIDGE_IMAGE=<fs-bridge image>`

Run:

```bash
cd packages/host-agent
npm install
npm run build
PORT=8790 node dist/server.js
```

Keep it private (VPC/private network only).

## 4) Register host in gateway

Call:

- `POST /control/hosts/register`
- `POST /control/hosts/heartbeat`

Body example:

```json
{
  "hostId": "do-blr1-host-01",
  "provider": "digitalocean",
  "region": "blr1",
  "apiBaseUrl": "http://10.0.0.12:8790",
  "capacityCpu": 8,
  "capacityMemMb": 16384,
  "usedCpu": 0,
  "usedMemMb": 0,
  "status": "active",
  "publicIp": "203.0.113.10",
  "privateIp": "10.0.0.12"
}
```

## 5) Provisioning flow

With managed onboarding, `container_pool` mode now:

1. selects host by utilization
2. creates `openclaw` + `fs-bridge` containers
3. configures `/ws/<workspaceId>` route
4. verifies runtime health
5. finalizes Synclaw connection

Legacy VM flow remains available via `MANAGED_RUNTIME_MODE=vm_legacy`.
