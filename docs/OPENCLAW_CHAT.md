# OpenClaw Chat (WS-Only, Per-Workspace Config)

Synclaw connects **directly from the browser** to your OpenClaw Gateway over WebSocket.

- No Fly bridge worker
- No Convex chat transcript persistence (OpenClaw is the source of truth)

## Configure OpenClaw (UI)

Open **Settings -> OpenClaw** (`/settings/openclaw`) in Synclaw and set:

- WebSocket URL (example: `wss://claw.sahayoga.in`)
- Auth token (and optional password)
- Client identity / role / scopes
- Chat behavior:
  - Subscribe on connect (and method)
  - Include cron/heartbeat sessions
  - History poll interval (ms) for `chat.history` hydration

If OpenClaw is not configured, `/chat` will show an empty state linking you to `/settings/openclaw`.

### Notes

- The token is stored **encrypted at rest** in Convex, but because this is direct browser WS, the token is still **client-visible at runtime**.
- Tool cards and the right-side Tool Output drawer are hydrated from `chat.history` (in-memory only; not persisted to Convex).

## Public WSS Security Baseline

Public WSS is the default recommended setup for production right now.

Minimum hardening checklist:

1. Use only `wss://` gateway URL (never `ws://` from HTTPS pages).
2. Add your Synclaw origin to OpenClaw `allowedOrigins`.
3. Approve the browser device in OpenClaw device approvals.
4. Keep scopes minimal (`operator.read`, `operator.write`, `operator.admin` for operator flows).
5. Protect dashboard/admin endpoints with strong auth and network controls.
6. Re-run Test in `/settings/openclaw` after any URL/auth/scope change.

### Threat model note

TLS certificate + nginx termination are necessary, but not sufficient by themselves.
You still need origin restrictions, device approval, least-privilege scopes, and admin/dashboard hardening.

## When To Use Connector (Advanced)

Use Connector only when OpenClaw is intentionally private (tailnet/private LAN/localhost upstream) and you operate a connector runtime on customer infrastructure.

- Connector is advanced/private-network path.
- Public WSS remains primary default until relay runtime is fully production-ready.
- If your app runs on `https://`, direct browser `ws://` will be blocked as mixed content.

## Convex Env Var (Required For Encrypting Secrets)

Set this on your Convex deployment:

```bash
OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX="<64 hex chars>"
```

Generate:

```bash
openssl rand -hex 32
```

Set on prod:

```bash
bunx convex env set OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX "<value>"
```

Set on dev:

```bash
bunx convex env set --dev OPENCLAW_TOKEN_ENCRYPTION_KEY_HEX "<value>"
```

## Vercel Env Vars

`NEXT_PUBLIC_OPENCLAW_*` env vars are **not used** anymore. OpenClaw connection settings live in Convex (per workspace) and are configured via `/settings/openclaw`.

## Fly.io Shutdown (Legacy)

If you previously deployed the old bridge app:

```bash
fly apps destroy sutraha-openclaw-bridge
```
