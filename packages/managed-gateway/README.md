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
