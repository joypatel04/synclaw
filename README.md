# Sutraha HQ

Sutraha HQ is a Next.js + Convex dashboard for managing an OpenClaw-powered agent workspace:

- Tasks, documents, broadcasts, and activity feed (Convex)
- Chat UI streaming directly from OpenClaw Gateway over WebSocket (no Convex chat persistence)
- Settings / workspace membership management
- MCP server package (see `packages/mcp-server`)

## Local Dev

### 1) Install deps

```bash
bun install
```

### 2) Configure env

```bash
cp .env.local.example .env.local
```

Update `.env.local` values for your Convex deployment + GitHub OAuth.

### 3) Start Convex + Next.js

Terminal 1:

```bash
bunx convex dev
```

Terminal 2:

```bash
bun run dev
```

Open the app (see the dev URL printed by Next.js).

### 4) Configure OpenClaw (per workspace)

Open **Settings -> OpenClaw** (`/settings/openclaw`) and set your gateway URL/token/scopes.

Note: to encrypt tokens at rest, set the Convex env var:

```bash
OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX=<openssl rand -hex 32>
```

## Docs

- Deployment: `docs/DEPLOYMENT.md`
- OpenClaw chat: `docs/OPENCLAW_CHAT.md`
