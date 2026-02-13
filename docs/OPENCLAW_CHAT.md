# OpenClaw Chat (Direct WS)

This repo now uses **direct browser WebSocket** to OpenClaw Gateway (no Fly bridge worker).

## Vercel / `.env.local`

```bash
NEXT_PUBLIC_CHAT_DIRECT_WS_ENABLED=true
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

# Optional: mirror cron/heartbeat sessions into the main chat thread
NEXT_PUBLIC_OPENCLAW_INCLUDE_CRON="true"

# Optional: background sync so heartbeat/tool runs show up even with no user send
NEXT_PUBLIC_OPENCLAW_HISTORY_POLL_MS="10000"
```

Notes:
- These are `NEXT_PUBLIC_*` vars, so the gateway token is exposed to the browser.
- Tool cards and the right-side Tool Output drawer are populated from `chat.history` (in-memory only; not persisted to Convex).

## Fly.io Shutdown

If you previously deployed the bridge app:

```bash
fly apps destroy sutraha-openclaw-bridge
```

After that you can delete any local bridge files (already removed from this repo).
