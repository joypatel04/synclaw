# Self-hosted Setup Guide (Current Codebase)

This guide is the canonical self-hosted runbook for Synclaw today.

## 1) Who should choose self-hosted

Choose self-hosted only if your team can operate:

- Convex deployments and environment variables
- OAuth provider app setup
- OpenClaw gateway runtime and security policy
- Optional Files Bridge runtime for remote file editing

If you want the fastest activation, use the Public WSS path.

## 2) Prerequisites

### Accounts and services

- Convex account/project
- GitHub OAuth app (Google optional based on your auth setup)
- OpenClaw gateway host (reachable from Synclaw)

### Local tools

- `bun` (or compatible Node.js runtime for app tooling)
- `git`
- shell access to set environment variables

## 3) Bootstrap the app

```bash
git clone <your-repo-url>
cd synclaw-hq
bun install
cp .env.local.example .env.local
```

Fill `.env.local` using the values from your own environments.

## 4) Required environment baseline

At minimum, set:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `CONVEX_DEPLOYMENT`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `AUTH_GOOGLE_ID` (if Google auth is enabled)
- `AUTH_GOOGLE_SECRET` (if Google auth is enabled)

If you need workspace files UI, set:

- `NEXT_PUBLIC_OPENCLAW_FILES_ENABLED=true`

For production UX default:

- `NEXT_PUBLIC_AGENT_SETUP_ADVANCED_ENABLED=false`

## 5) Convex backend setup

Start local development:

```bash
bunx convex dev
```

Set the OpenClaw token encryption key in Convex env:

```bash
openssl rand -hex 32
bunx convex env set OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX <generated_hex>
```

For production deployment:

```bash
bunx convex deploy
```

## 6) Run the app locally

Terminal A:

```bash
bunx convex dev
```

Terminal B:

```bash
bun run dev
```

Open the local URL printed by Next.js.

## 7) Configure OpenClaw workspace connection

In Synclaw UI:

1. Open `Settings -> OpenClaw`.
2. Set gateway URL + auth token.
3. Save and run connection verification.

On the OpenClaw side, verify:

- Gateway is running.
- `gateway.controlUi.allowedOrigins` includes your app domain(s).
- Auth mode and token match what Synclaw sends.

## 8) One-click agent creation flow

Use onboarding or `/agents/new`:

1. Pick agent template.
2. Click **Create & Configure Agent**.
3. Wait for automatic file pack generation.
4. Continue in `/chat/<agentId>`.

If setup fails, the create flow hard-fails and rolls back (no active orphan agent is left behind).

## 9) Optional: Files Bridge for remote editing

Run `packages/fs-bridge` on the host that owns your agent workspace path:

```bash
cd packages/fs-bridge
docker build -t synclaw-fs-bridge .
docker run --rm -p 8787:8787 \
  -e FS_BRIDGE_TOKEN="replace_me" \
  -e WORKSPACE_ROOT_PATH="/srv/openclaw/workspaces/main" \
  -e FS_MAX_FILE_BYTES="1048576" \
  -e FS_ALLOWED_EXTENSIONS=".md,.txt,.json,.yaml,.yml,.toml,.config,.js,.jsx,.mjs,.ts,.tsx" \
  -v /srv/openclaw/workspaces/main:/srv/openclaw/workspaces/main \
  synclaw-fs-bridge
```

Then configure bridge settings in `/filesystem`.

## 10) Production deployment checklist

1. Deploy app (for example, Vercel or your own Next.js host).
2. Deploy Convex functions (`bunx convex deploy`) from the same commit.
3. Set production env vars in app host and Convex.
4. Confirm OAuth callback URLs match production Convex site URL.
5. Verify OpenClaw connection from production workspace.
6. Create one agent and run one deterministic test task.

## 11) Smoke test (must pass)

- Login works.
- Workspace loads.
- OpenClaw connect/verify succeeds.
- One-click agent setup succeeds.
- Chat can run at least one task.
- Activity feed updates.

## 12) Common failure points

- OAuth callback mismatch between provider and Convex site.
- Missing `OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX`.
- OpenClaw origin policy blocking Synclaw domain.
- Gateway token mismatch or missing scopes.
- Files Bridge root path/token mismatch.

Use `/docs/hosting/troubleshooting` for deeper diagnostics.
