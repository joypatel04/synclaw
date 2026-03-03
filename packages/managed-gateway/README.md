# Synclaw Managed Gateway

Single-domain managed control plane + WebSocket gateway for path-based workspace routing.

## Endpoints

- `GET /control/health`
- `POST /control/bootstrap`
- `POST /control/routes`
- `POST /control/routes/delete`
- `GET /control/routes/verify?workspaceId=...`
- WebSocket: `GET /ws/:workspaceId`

## Local Run

```bash
cd packages/managed-gateway
cp .env.example .env
# edit .env (set MANAGED_GATEWAY_API_TOKEN at minimum)
npm install
npm run build
npm start
```

## Required env

- `MANAGED_GATEWAY_API_TOKEN`

## Important env

- `MANAGED_GATEWAY_DB_PATH` (default: `/var/lib/managed-gateway/routes.db`)
- `WORKSPACE_WS_PATH_PREFIX` (default: `/ws`)
- `MANAGED_UPSTREAM_WS_SCHEME` (default: `ws`)
- `MANAGED_UPSTREAM_WS_PORT` (default: `8765`)
- `MANAGED_UPSTREAM_WS_PATH` (default: `/ws`)
- `MANAGED_BOOTSTRAP_TIMEOUT_MS`
- `MANAGED_HEALTHCHECK_TIMEOUT_MS`
- `MANAGED_BOOTSTRAP_SCRIPT` (optional custom SSH bootstrap script)

## Deployment

Use `docker-compose.yml` in this folder on your Hetzner VM.

Recommended:

```bash
cp .env.example .env
# edit .env
docker compose up -d --build
```

Important:
- Do not proxy catch-all traffic back to the same gateway domain (proxy loop risk).
- Keep this gateway domain dedicated to `/control/*` and `/ws/*`.
- If you need same-domain frontend routing later, point fallback to a different upstream host (for example your Vercel app domain), never to itself.
