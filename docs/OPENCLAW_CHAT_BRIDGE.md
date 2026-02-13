# OpenClaw Chat Bridge Migration

## Direct WS Mode (Vercel Frontend)

Use this if you want OpenClaw-like behavior directly from browser to Gateway, without Fly bridge worker.

Set these in Vercel:

```bash
NEXT_PUBLIC_CHAT_DIRECT_WS_ENABLED=true
NEXT_PUBLIC_CHAT_BRIDGE_ENABLED=false
NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL="wss://claw.sahayoga.in"
NEXT_PUBLIC_OPENCLAW_GATEWAY_PROTOCOL="req"
NEXT_PUBLIC_OPENCLAW_GATEWAY_AUTH_TOKEN="<gateway-token>"
NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_ID="cli"
NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_MODE="webchat"
NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_PLATFORM="web"
NEXT_PUBLIC_OPENCLAW_GATEWAY_ROLE="operator"
NEXT_PUBLIC_OPENCLAW_GATEWAY_SCOPES="operator.read,operator.write,operator.admin"
NEXT_PUBLIC_OPENCLAW_GATEWAY_CHAT_SUBSCRIBE="true"
NEXT_PUBLIC_OPENCLAW_GATEWAY_SUBSCRIBE_METHOD="chat.subscribe"
```

Notes:
- `chat.subscribe` may not exist in some gateway builds. Client now ignores that error and continues.
- User/assistant transcript is still mirrored into Convex via `chatMessages.send` + `chatIngest.upsertGatewayEvent`.
- In direct mode, browser has gateway credentials by design. Use only if acceptable for your project.

### Copy/Paste env for direct mode (NOT secure)

```bash
NEXT_PUBLIC_CHAT_DIRECT_WS_ENABLED=true
NEXT_PUBLIC_CHAT_BRIDGE_ENABLED=false
NEXT_PUBLIC_OPENCLAW_GATEWAY_WS_URL="wss://claw.sahayoga.in"
NEXT_PUBLIC_OPENCLAW_GATEWAY_PROTOCOL="req"
NEXT_PUBLIC_OPENCLAW_GATEWAY_AUTH_TOKEN="<gateway-token>"
NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_ID="cli"
NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_MODE="webchat"
NEXT_PUBLIC_OPENCLAW_GATEWAY_CLIENT_PLATFORM="web"
NEXT_PUBLIC_OPENCLAW_GATEWAY_ROLE="operator"
NEXT_PUBLIC_OPENCLAW_GATEWAY_SCOPES="operator.read,operator.write,operator.admin"
NEXT_PUBLIC_OPENCLAW_GATEWAY_CHAT_SUBSCRIBE="true"
NEXT_PUBLIC_OPENCLAW_GATEWAY_SUBSCRIBE_METHOD="chat.subscribe"
```

## Secure Production Mode (Recommended)

If you need token security, do not use browser WS token auth. Keep token server-side in bridge/Fly.

### Copy/Paste env for secure mode (Vercel + Fly bridge)

Vercel (frontend only):

```bash
NEXT_PUBLIC_CHAT_DIRECT_WS_ENABLED=false
NEXT_PUBLIC_CHAT_BRIDGE_ENABLED=true
```

Fly bridge secrets (server-side only):

```bash
CONVEX_URL="https://<your-project>.convex.cloud"
CONVEX_SITE_URL="https://<your-project>.convex.site"
SUTRAHA_API_KEY="sk_<workspace_api_key>"
SUTRAHA_WORKSPACE_ID="<workspace_id>"
OPENCLAW_GATEWAY_AUTH_TOKEN="<gateway_token>"
OPENCLAW_GATEWAY_WS_URL="wss://<gateway-host>"
OPENCLAW_GATEWAY_PROTOCOL="req"
OPENCLAW_GATEWAY_CLIENT_ID="<gateway-allowed-client-id>"
OPENCLAW_GATEWAY_CLIENT_MODE="<gateway-allowed-client-mode>"
OPENCLAW_GATEWAY_CLIENT_PLATFORM="node"
OPENCLAW_GATEWAY_ROLE="operator"
OPENCLAW_GATEWAY_SCOPES="operator.read,operator.write,operator.admin"
OPENCLAW_GATEWAY_ORIGIN="https://<allowed-origin>"
OPENCLAW_GATEWAY_CHAT_SUBSCRIBE="false"
```

### Removing bridge package later

After direct mode is stable:
1. Remove `packages/openclaw-bridge`.
2. Remove Fly app and Fly bridge secrets.
3. Delete bridge-only Convex path if desired (`chatOutbox`, bridge worker flows).
4. Keep `chatMessages` + `chatIngest` if you still want Convex transcript/history.

## 1) Deploy schema and functions

1. Run Convex deploy/codegen after pulling this branch.
2. Backfill is optional if legacy chat history is not needed.
3. If you do want backfill:

```bash
npx convex run chatMessages:backfillLegacyMessages '{"workspaceId":"<workspace-id>"}'
```

## 2) Enable bridge flow in web app

Set in Vercel (or your frontend host):

```bash
NEXT_PUBLIC_CHAT_BRIDGE_ENABLED=true
```

If false, chat falls back to legacy `chatActions.sendToAgent` HTTP path.

## 3) Start bridge worker (Local Development)

```bash
cd packages/openclaw-bridge
bun install
bun run dev
```

## 4) Deploy bridge worker to Fly.io (Production)

Run from:

```bash
cd packages/openclaw-bridge
```

### 4.1 Validate config

```bash
fly config validate
```

### 4.2 Set secrets (names + placeholders only)

Important: never commit real secret values into git.

```bash
fly secrets set \
  CONVEX_URL="https://<your-project>.convex.cloud" \
  CONVEX_SITE_URL="https://<your-project>.convex.site" \
  SUTRAHA_API_KEY="sk_<workspace_api_key>" \
  SUTRAHA_WORKSPACE_ID="<workspace_id>" \
  OPENCLAW_GATEWAY_AUTH_TOKEN="<gateway_token>" \
  OPENCLAW_GATEWAY_WS_URL="wss://<gateway-host>[/ws]" \
  OPENCLAW_GATEWAY_PROTOCOL="req" \
  OPENCLAW_GATEWAY_CLIENT_ID="<gateway-allowed-client-id>" \
  OPENCLAW_GATEWAY_CLIENT_MODE="<gateway-allowed-client-mode>" \
  OPENCLAW_GATEWAY_CLIENT_PLATFORM="node" \
  OPENCLAW_GATEWAY_ROLE="operator" \
  OPENCLAW_GATEWAY_SCOPES="operator.read,operator.write,operator.admin" \
  OPENCLAW_GATEWAY_ORIGIN="https://<allowed-origin>" \
  OPENCLAW_GATEWAY_CHAT_SUBSCRIBE="false" \
  --app sutraha-openclaw-bridge
```

### 4.3 Deploy

```bash
fly deploy --remote-only --app sutraha-openclaw-bridge
```

### 4.4 Confirm runtime

```bash
fly logs --app sutraha-openclaw-bridge
fly status --app sutraha-openclaw-bridge
fly scale count 1 --app sutraha-openclaw-bridge
```

## 5) Secrets currently used for this app

These are the secret names currently configured in Fly (`fly secrets list --app sutraha-openclaw-bridge`):

- `CONVEX_SITE_URL`: Convex site URL for token exchange endpoint.
- `CONVEX_URL`: Convex deployment URL for queries/mutations.
- `SUTRAHA_API_KEY`: Workspace API key used by bridge worker.
- `SUTRAHA_WORKSPACE_ID`: Workspace that bridge reads/writes.
- `OPENCLAW_GATEWAY_AUTH_TOKEN`: Gateway auth token.
- `OPENCLAW_GATEWAY_WS_URL`: Gateway websocket URL.
- `OPENCLAW_GATEWAY_PROTOCOL`: WS request framing (`req` or `jsonrpc`).
- `OPENCLAW_GATEWAY_CLIENT_ID`: Client id expected by Gateway `connect` schema.
- `OPENCLAW_GATEWAY_CLIENT_MODE`: Client mode expected by Gateway `connect` schema.
- `OPENCLAW_GATEWAY_CLIENT_PLATFORM`: Client platform metadata.
- `OPENCLAW_GATEWAY_ROLE`: Requested gateway role.
- `OPENCLAW_GATEWAY_SCOPES`: Requested scopes.
- `OPENCLAW_GATEWAY_ORIGIN`: Origin header used for gateway origin allowlist checks.
- `OPENCLAW_GATEWAY_CHAT_SUBSCRIBE`: Whether bridge attempts `chat.subscribe` on connect.

## 5.1 Captured values from this rollout thread

These are the values captured in this chat/terminal history so you don't need to recall them.
If a value was not printed directly and only inferred from the commands we used, it is marked as inferred.

- `CONVEX_SITE_URL`: `https://confident-ram-83.convex.site`
- `CONVEX_URL`: `https://confident-ram-83.convex.cloud`
- `OPENCLAW_GATEWAY_AUTH_TOKEN`: `b2f239a391c4228006e3916d92808b458fb6cc0845179a15`
- `OPENCLAW_GATEWAY_WS_URL`: `wss://claw.sahayoga.in` 
- `SUTRAHA_API_KEY`: `sk_b962e98e0c282e89e529d768eb9142623194add2cf2d64de`
- `SUTRAHA_WORKSPACE_ID`: `md73rec5m5yjhgv929ps00smj980s49x`
- `OPENCLAW_GATEWAY_PROTOCOL`: `req`
- `OPENCLAW_GATEWAY_CLIENT_ID`: `cli` (inferred from rollout commands/defaults)
- `OPENCLAW_GATEWAY_CLIENT_MODE`: `webchat`
- `OPENCLAW_GATEWAY_CLIENT_PLATFORM`: `node` (inferred from rollout commands/defaults)
- `OPENCLAW_GATEWAY_ROLE`: `operator` (inferred from rollout commands/defaults)
- `OPENCLAW_GATEWAY_SCOPES`: `operator.read,operator.write,operator.admin`
- `OPENCLAW_GATEWAY_ORIGIN`: `https://claw.sahayoga.in`
- `OPENCLAW_GATEWAY_CHAT_SUBSCRIBE`: `false`

## 6) Troubleshooting notes from this rollout

### A) `npm ci` failed in Fly build

Error:
- `npm ci can only install with an existing package-lock.json`

Fix:
- Use Bun image + Bun install in `packages/openclaw-bridge/dockerfile`.

### B) WS handshake rejected (`invalid connect params`)

Errors seen:
- invalid `client/id`
- invalid `client/mode`

Fix:
- Make `OPENCLAW_GATEWAY_CLIENT_ID` and `OPENCLAW_GATEWAY_CLIENT_MODE` configurable via secrets.

### C) Scope/origin policy failures

Errors seen:
- `missing scope: operator.admin`
- `origin not allowed`

Fix:
- Include required scope in `OPENCLAW_GATEWAY_SCOPES`.
- Set `OPENCLAW_GATEWAY_ORIGIN` to an origin allowed by gateway policy.

### D) `unknown method: chat.subscribe`

Cause:
- Current gateway build does not expose `chat.subscribe`.

Fix:
- Keep `OPENCLAW_GATEWAY_CHAT_SUBSCRIBE="false"`.
- Bridge also now treats unsupported `chat.subscribe` as non-fatal.

### E) `invalid chat.send params`

Error seen:
- `invalid chat.send params: must have required property 'message'; must have required property 'idempotencyKey'; unexpected property 'content'; unexpected property 'clientMessageId'`

Cause:
- Gateway `chat.send` schema in this deployment expects `message` and `idempotencyKey`.

Fix applied:
- Bridge payload was updated to:
  - `message: <text>`
  - `idempotencyKey: <clientMessageId>`

## 7) Verification checklist

- Send a chat message from `/chat/[agentId]`.
- Verify user message appears as `Queued` then `Sending/Streaming/Completed`.
- Verify agent reply is written back into `chatMessages`.
- Stop bridge and send a message; verify retries and failed state behavior.
- Retry a failed message in UI; verify outbox is re-queued and sent.

## 8) Observability checks

- `chatOutbox` rows with `status=queued|claimed|failed`
- `chatEvents` growth and dedupe behavior
- `chatMessages` rows with `state=failed`
