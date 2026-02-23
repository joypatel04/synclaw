# Synclaw

Synclaw is a Next.js + Convex dashboard for managing an OpenClaw-powered agent workspace:

- Tasks, documents, broadcasts, and activity feed (Convex)
- Chat UI streaming directly from OpenClaw Gateway over WebSocket (no Convex chat persistence)
- Settings / workspace membership management
- Razorpay per-workspace billing (`/settings/billing`)
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

Update `.env.local` values for your Convex deployment + Convex Auth GitHub OAuth keys.
If you want billing enabled, configure Razorpay keys and plan IDs.

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

Open **Settings -> Billing** (`/settings/billing`) to manage plan checkout/portal flows.

Webhook endpoint:
- Razorpay: `/api/v1/billing/razorpay/webhook`

Note: to encrypt tokens at rest, set the Convex env var:

```bash
OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX=<openssl rand -hex 32>
```

## Docs

- Deployment: `docs/DEPLOYMENT.md`
- OpenClaw chat: `docs/OPENCLAW_CHAT.md`
- Product overview: `docs/product/OVERVIEW.md`
- Hosting guide: `docs/product/HOSTING_GUIDE.md`
- Cloud setup: `docs/product/CLOUD_GET_STARTED.md`
- Self-hosted prerequisites: `docs/product/SELF_HOSTED_PREREQUISITES.md`
- Self-hosted Convex setup: `docs/product/SELF_HOSTED_SETUP_CONVEX.md`
- Self-hosted MCP setup: `docs/product/SELF_HOSTED_SETUP_MCP.md`
- Self-hosted local run: `docs/product/SELF_HOSTED_RUN_LOCAL.md`
- Self-hosted troubleshooting: `docs/product/SELF_HOSTED_TROUBLESHOOTING.md`
- Pricing model: `docs/product/PRICING.md`
- FAQ: `docs/product/FAQ.md`
# Vercel build trigger - Mon Feb 23 05:12:08 PM UTC 2026
