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
NEXT_PUBLIC_APP_NAME=Sutraha HQ
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
SITE_URL=https://hq.sutraha.in
AUTH_GITHUB_ID=<GitHub OAuth App ID>
AUTH_GITHUB_SECRET=<GitHub OAuth App Secret>
JWT_PRIVATE_KEY=<RSA private key>
JWKS=<JSON Web Key Set>
OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX=<64 hex chars (openssl rand -hex 32)>
```

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

## 3. MCP Server (@sutraha/mcp-server)

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
npm update -g @sutraha/mcp-server
```

---

## 4. GitHub OAuth App

If you change the Convex deployment or domain, update the GitHub OAuth App:

1. Go to: https://github.com/settings/developers
2. Select the OAuth App
3. Update **Authorization callback URL** to:
   - Dev: `https://descriptive-perch-695.convex.site/api/auth/callback/github`
   - Prod: `https://confident-ram-83.convex.site/api/auth/callback/github`
4. Update **Homepage URL** to your app URL

---

## 5. OpenClaw Files Bridge (Docker)

Deploy this when enabling remote OpenClaw workspace file browsing/editing.

### Build and Run

```bash
cd packages/fs-bridge
docker build -t sutraha-fs-bridge .

docker run --rm -p 8787:8787 \
  -e FS_BRIDGE_TOKEN="replace_me" \
  -e WORKSPACE_ROOT_PATH="/srv/openclaw/workspaces/main" \
  -e FS_MAX_FILE_BYTES="1048576" \
  -e FS_ALLOWED_EXTENSIONS=".md,.txt,.json,.yaml,.yml,.toml,.config" \
  -v /srv/openclaw/workspaces/main:/srv/openclaw/workspaces/main \
  sutraha-fs-bridge
```

### Sutraha HQ Setup

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
| SITE_URL | `http://localhost:3001` | `https://hq.sutraha.in` |
