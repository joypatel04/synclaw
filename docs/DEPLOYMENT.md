# Deployment Guide

## Architecture Overview

| Component | Platform | Auto-deploy? |
|-----------|----------|-------------|
| Frontend (Next.js) | Vercel | Yes — on git push |
| Backend (Convex) | Convex Cloud | No — manual deploy |
| MCP Server | npm | No — manual publish |

---

## 1. Frontend (Vercel)

**Auto-deploys on every push to `main`.** No manual steps needed.

- Dashboard: https://vercel.com/dashboard
- Production URL: https://hq.sutraha.in

### Environment Variables (Vercel)

```
NEXT_PUBLIC_CONVEX_URL=https://confident-ram-83.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://confident-ram-83.convex.site
NEXT_PUBLIC_SYNCLAW_EDITION=commercial
NEXT_PUBLIC_MANAGED_BETA_ENABLED=false
NEXT_PUBLIC_MANAGED_INTERNAL_CONTROLS_ENABLED=false
NEXT_PUBLIC_ASSISTED_LAUNCH_BETA_ENABLED=false
NEXT_PUBLIC_APP_NAME=Synclaw
NEXT_PUBLIC_APP_URL=https://hq.sutraha.in
```

---

## 2. Convex Backend

**Must be deployed manually** after changes to any file in `convex/`.

### Deploy to Production

```bash
bunx convex deploy
```

Confirm when prompted. This pushes schema, functions, and HTTP routes to prod.

### Deploy to Dev (auto via `convex dev`)

```bash
bunx convex dev
```

This watches for changes and auto-deploys to dev (`descriptive-perch-695`).

### Manage Environment Variables

```bash
# List all env vars on prod
bunx convex env list

# Set a variable on prod
bunx convex env set VARIABLE_NAME "value"

# Dev env vars (uses --dev or are set during `convex dev`)
bunx convex env list --dev
```

### Required Prod Environment Variables

```
SYNCLAW_EDITION=commercial
SYNCLAW_MANAGED_BETA_ENABLED=false
SYNCLAW_ASSISTED_LAUNCH_ENABLED=false
AUTH_GITHUB_ID=<GitHub OAuth App ID>
AUTH_GITHUB_SECRET=<GitHub OAuth App Secret>
AUTH_GOOGLE_ID=<Google OAuth Client ID>
AUTH_GOOGLE_SECRET=<Google OAuth Client Secret>
JWT_PRIVATE_KEY=<RSA private key>
JWKS=<JSON Web Key Set>
OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX=<64 hex chars (openssl rand -hex 32)>
MANAGED_OPENCLAW_WSS_TEMPLATE=wss://synclaw.in/ws/{workspaceId}
```

Public beta recommendation:
- keep `SYNCLAW_MANAGED_BETA_ENABLED=false`
- keep `NEXT_PUBLIC_MANAGED_BETA_ENABLED=false`
- keep `NEXT_PUBLIC_MANAGED_INTERNAL_CONTROLS_ENABLED=false`

**Cloud provider for new managed servers** (default: Hostinger):

- **Hostinger**: set `HOSTINGER_API_TOKEN` and `MANAGED_HOSTINGER_CATALOG_ITEM_ID`. See [docs/HOSTINGER_MIGRATION.md](HOSTINGER_MIGRATION.md).
- **AWS**: set `MANAGED_CLOUD_PROVIDER=aws` and AWS credentials.

### Managed Provisioning Control Plane Vars (Recommended)

```
MANAGED_DEFAULT_SERVER_PROFILE=starter
# Hostinger (default): see HOSTINGER_MIGRATION.md for HOSTINGER_API_TOKEN, MANAGED_HOSTINGER_CATALOG_ITEM_ID, region mapping

MANAGED_CONTROL_PLANE_BASE_URL=https://synclaw.in/control
MANAGED_BOOTSTRAP_API_BASE_URL=https://synclaw.in/control
MANAGED_BOOTSTRAP_API_TOKEN=<token>
MANAGED_BOOTSTRAP_USER=root
MANAGED_BOOTSTRAP_SSH_PRIVATE_KEY=<private key>
MANAGED_BOOTSTRAP_TIMEOUT_MS=120000
MANAGED_BOOTSTRAP_STRICT=false

MANAGED_GATEWAY_API_BASE_URL=https://synclaw.in/control
MANAGED_GATEWAY_API_TOKEN=<token>
MANAGED_GATEWAY_STRICT=false
MANAGED_HEALTHCHECK_TIMEOUT_MS=60000
MANAGED_UPSTREAM_WS_PORT=18789
MANAGED_RUNTIME_MODE=vm_legacy   # vm_legacy | container_pool
MANAGED_RUNTIME_RESOURCE_PROFILE=default
MANAGED_HOST_AGENT_SHARED_TOKEN=<shared host-agent token>
MANAGED_HOST_POOL_MAX_UTILIZATION=0.75
MANAGED_HOST_AGENT_TIMEOUT_MS=45000
```

Container-pool mode also requires at least one registered host:
- `POST /control/hosts/register`
- `POST /control/hosts/heartbeat`

Each runtime host must run `packages/host-agent` privately (not internet-exposed).

To generate JWT keys for a new deployment:

```bash
bunx @convex-dev/auth
```

### When to Deploy Convex

Deploy after changing any file in:
- `convex/schema.ts` (schema changes)
- `convex/*.ts` (queries, mutations, actions)
- `convex/lib/*.ts` (shared helpers)
- `convex/http.ts` (HTTP endpoints)
- `convex/auth.ts` or `convex/auth.config.ts` (auth config)

---

## 3. MCP Server (@synclaw/mcp-server)

**Must be published manually** after changes to `packages/mcp-server/`.

### Build and Publish

```bash
cd packages/mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Bump version
npm version patch   # 0.1.0 → 0.1.1
# or
npm version minor   # 0.1.0 → 0.2.0

# Publish to npm
npm publish --access public
```

### When to Publish

Publish after changing any file in:
- `packages/mcp-server/src/*.ts` (tools, client, CLI)
- `packages/mcp-server/package.json` (dependencies)

### After Publishing

On the OpenClaw server, the new version is picked up automatically if using `npx` (it fetches latest). If installed globally:

```bash
npm update -g @synclaw/mcp-server
```

---

## 4. Managed Gateway Control Plane (`packages/managed-gateway`)

Deploy this on a single VM to support:
- `POST /control/bootstrap`
- `POST /control/hosts/register`
- `POST /control/hosts/heartbeat`
- `POST /control/tenant/create`
- `POST /control/tenant/delete`
- `POST /control/tenant/restart`
- `GET /control/tenant/verify`
- `POST /control/routes`
- `POST /control/routes/delete`
- `GET /control/routes/verify`
- `wss://synclaw.in/ws/<workspaceId>`

### Build and Run on VM

```bash
cd packages/managed-gateway
docker compose up -d --build
```

### DNS / Reverse Proxy

Point `synclaw.in` to the gateway VM and use `packages/managed-gateway/Caddyfile`:
- `/ws/*` and `/control/*` -> managed gateway container
- all other traffic -> Vercel app origin

### Control Plane Token

Set the same token in both places:
- Gateway VM env: `MANAGED_GATEWAY_API_TOKEN`
- Convex env: `MANAGED_GATEWAY_API_TOKEN` (and `MANAGED_BOOTSTRAP_API_TOKEN` optionally)

---

## 5. OAuth Apps (GitHub + Google)

If you change the Convex deployment or domain, update both OAuth providers:

1. GitHub:
   - Go to: https://github.com/settings/developers
   - Select the OAuth App
   - Update **Authorization callback URL** to:
   - Dev: `https://descriptive-perch-695.convex.site/api/auth/callback/github`
   - Prod: `https://confident-ram-83.convex.site/api/auth/callback/github`
   - Update **Homepage URL** to your app URL
2. Google Cloud Console:
   - Open your OAuth 2.0 Web Client.
   - Set **Authorized redirect URIs**:
     - Dev: `https://descriptive-perch-695.convex.site/api/auth/callback/google`
     - Prod: `https://confident-ram-83.convex.site/api/auth/callback/google`
   - Set **Authorized JavaScript origins** for local/prod app URLs.

---

## 6. OpenClaw Files Bridge (Docker)

Deploy this when enabling remote OpenClaw workspace file browsing/editing.

### Build and Run

```bash
cd packages/fs-bridge
docker build -t sutraha-fs-bridge .

docker run --rm -p 8787:8787 \
  -e FS_BRIDGE_TOKEN="replace_me" \
  -e WORKSPACE_ROOT_PATH="/srv/openclaw/workspaces/main" \
  -e FS_MAX_FILE_BYTES="1048576" \
  -e FS_ALLOWED_EXTENSIONS=".md,.txt,.json,.yaml,.yml,.toml,.config,.js,.jsx,.mjs,.ts,.tsx" \
  -v /srv/openclaw/workspaces/main:/srv/openclaw/workspaces/main \
  sutraha-fs-bridge
```

### Synclaw Setup

1. In `/filesystem`, enable **Workspace Files Bridge**.
2. Set bridge URL + root path and save.
3. Set bridge token and save.
4. Use **Workspace Files (Remote)** panel to test and edit files.

---

## Quick Reference

### Full Production Deploy (all components)

```bash
# 1. Push frontend (auto-deploys via Vercel)
git push origin main

# 2. Deploy Convex backend
bunx convex deploy

# 3. Publish MCP server (only if changed)
cd packages/mcp-server
npm run build && npm version patch && npm publish --access public
```

### Dev Environment

```bash
# Terminal 1: Next.js dev server
bun run dev

# Terminal 2: Convex dev (auto-deploys on save)
bunx convex dev
```

---

## Deployment Environments

| | Dev | Production |
|---|---|---|
| Convex | `descriptive-perch-695` | `confident-ram-83` |
| Convex Cloud | `descriptive-perch-695.convex.cloud` | `confident-ram-83.convex.cloud` |
| Convex Site | `descriptive-perch-695.convex.site` | `confident-ram-83.convex.site` |
| Frontend | `localhost:3001` | `hq.sutraha.in` |
| NEXT_PUBLIC_APP_URL | `http://localhost:3001` | `https://synclaw.in` |
