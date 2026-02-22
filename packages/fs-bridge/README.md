# sutraha-fs-bridge

Remote filesystem bridge for Sutraha HQ OpenClaw workspaces.

## Endpoints

- `GET /health`
- `GET /v1/tree?path=<relative>`
- `GET /v1/file?path=<relative>`
- `PUT /v1/file` with `{ path, content, expectedHash? }`
- `GET /v1/meta?path=<relative>`

## Security defaults

- Bearer auth required (`FS_BRIDGE_TOKEN`)
- Root jail required (`WORKSPACE_ROOT_PATH`)
- Text file extension allowlist (`FS_ALLOWED_EXTENSIONS`)
- Max file size (`FS_MAX_FILE_BYTES`, default 1 MB)
- Basic in-memory rate limit

## Run with Docker

```bash
docker build -t sutraha-fs-bridge .

docker run --rm -p 8787:8787 \
  -e FS_BRIDGE_TOKEN="replace_me" \
  -e WORKSPACE_ROOT_PATH="/srv/openclaw/workspaces/main" \
  -e FS_MAX_FILE_BYTES="1048576" \
  -e FS_ALLOWED_EXTENSIONS=".md,.txt,.json,.yaml,.yml,.toml,.config" \
  -v /srv/openclaw/workspaces/main:/srv/openclaw/workspaces/main \
  sutraha-fs-bridge
```

## Publish image (example)

```bash
docker tag sutraha-fs-bridge ghcr.io/sutraha/sutraha-fs-bridge:0.1.0
docker push ghcr.io/sutraha/sutraha-fs-bridge:0.1.0
```
