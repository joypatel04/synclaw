# Synclaw

Synclaw is a Next.js + Convex dashboard for managing an OpenClaw-powered agent workspace:

- Tasks, documents, broadcasts, and activity feed (Convex)
- Chat UI streaming directly from OpenClaw Gateway over WebSocket (no Convex chat persistence)
- Settings / workspace membership management
- MCP server package (see `packages/mcp-server`)

## Editions

- `core` (OSS): manual/BYO OpenClaw workflows and core product surfaces.
- `commercial`: internal/extended ops surfaces used for private testing.

Set edition using:

```bash
SYNCLAW_EDITION=core|commercial
NEXT_PUBLIC_SYNCLAW_EDITION=core|commercial
```

## Public OSS Beta Profile

For open-source beta launch (Public WSS/BYO OpenClaw only), use:

```bash
SYNCLAW_EDITION=core
NEXT_PUBLIC_SYNCLAW_EDITION=core
SYNCLAW_MANAGED_BETA_ENABLED=false
SYNCLAW_ASSISTED_LAUNCH_ENABLED=false
NEXT_PUBLIC_MANAGED_BETA_ENABLED=false
NEXT_PUBLIC_ASSISTED_LAUNCH_BETA_ENABLED=false
NEXT_PUBLIC_BILLING_ENABLED=false
```

For internal extended-flow testing, switch to `commercial` and enable the related flags.

To prepare an OSS beta bundle quickly:

```bash
bun run export:oss-beta
```

## Local Dev

### 1) Install deps

```bash
bun install
```

### 2) Configure env

```bash
cp .env.local.example .env.local
```

Update `.env.local` values for your Convex deployment + Convex Auth GitHub/Google OAuth keys.
If you run `commercial`, configure internal ops env vars as needed.

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

- Public docs index: `docs/README.md`
- Legacy/internal docs archive: `docs/legacy/`
- OSS edition track: `docs/oss/README.md`
- OpenClaw chat: `docs/OPENCLAW_CHAT.md`
- Product overview: `docs/product/OVERVIEW.md`
- Hosting guide: `docs/product/HOSTING_GUIDE.md`
- Public WSS setup: `docs/product/CLOUD_GET_STARTED.md`
- Self-hosted guide: `docs/product/SELF_HOSTED_GUIDE.md`
- Pricing model: `docs/product/PRICING.md`
- FAQ: `docs/product/FAQ.md`
# Vercel build trigger - Mon Feb 23 05:12:08 PM UTC 2026
