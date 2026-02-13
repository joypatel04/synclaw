# OpenClaw Bridge

Durable worker that bridges Sutraha chat outbox commands to OpenClaw Gateway WebSocket and mirrors inbound gateway events into Convex.

## What it does

- Claims queued chat commands from `chatOutbox`
- Sends `chat.send` / `chat.abort` to Gateway WS
- Marks outbox item as sent/failed with retry backoff
- Ingests inbound gateway events into `chatIngest.upsertGatewayEvent`
- Provides idempotent event projection to `chatEvents`, `chatSessions`, `chatMessages`

## Environment

Required:

- `OPENCLAW_GATEWAY_WS_URL`
- `CONVEX_URL`
- `CONVEX_SITE_URL`
- `SUTRAHA_API_KEY`
- `SUTRAHA_WORKSPACE_ID`

Optional:

- `OPENCLAW_GATEWAY_AUTH_TOKEN`
- `OPENCLAW_GATEWAY_PASSWORD`
- `OPENCLAW_GATEWAY_PROTOCOL=req` (`req` or `jsonrpc`)
- `OPENCLAW_GATEWAY_CLIENT_ID=cli`
- `OPENCLAW_GATEWAY_CLIENT_MODE=operator`
- `OPENCLAW_GATEWAY_CLIENT_PLATFORM=node`
- `OPENCLAW_GATEWAY_ROLE=operator`
- `OPENCLAW_GATEWAY_SCOPES=operator.read,operator.write`
- `OPENCLAW_GATEWAY_CHAT_SUBSCRIBE=true`
- `BRIDGE_WORKER_ID=openclaw-bridge-1`
- `BRIDGE_POLL_INTERVAL_MS=1500`
- `BRIDGE_BATCH_SIZE=20`
- `BRIDGE_RECONNECT_MIN_MS=1000`
- `BRIDGE_RECONNECT_MAX_MS=15000`

## Run

```bash
cd packages/openclaw-bridge
npm install
npm run dev
```

## Production

Run as a long-lived process on Fly.io/Render/Railway/VM. Do not deploy as short-lived serverless function.
