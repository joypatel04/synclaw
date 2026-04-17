# synclaw-fs-bridge

Remote filesystem bridge for Synclaw OpenClaw workspaces.

## Endpoints

- `GET /health`
- `GET /v1/tree?path=<relative>`
- `GET /v1/file?path=<relative>`
- `PUT /v1/file` with `{ path, content, expectedHash? }`
- `DELETE /v1/file?path=<relative>`
- `GET /v1/meta?path=<relative>`

## Security defaults

- Bearer auth required (`FS_BRIDGE_TOKEN`)
- Root jail required (`WORKSPACE_ROOT_PATH`)
- Text file extension allowlist for write (`FS_ALLOWED_EXTENSIONS`)
- Binary read extension allowlist (`FS_ALLOWED_BINARY_READ_EXTENSIONS`, default `.pdf`)
- Max file size (`FS_MAX_FILE_BYTES`, default 1 MB)
- Basic in-memory rate limit

## Run with Docker

```bash
docker build -t synclaw-fs-bridge .

docker run --rm -p 8787:8787 \
  -e FS_BRIDGE_TOKEN="replace_me" \
  -e WORKSPACE_ROOT_PATH="/srv/openclaw/workspaces/main" \
  -e FS_MAX_FILE_BYTES="1048576" \
  -e FS_ALLOWED_EXTENSIONS=".md,.txt,.json,.yaml,.yml,.toml,.config,.js,.jsx,.mjs,.ts,.tsx" \
  -e FS_ALLOWED_BINARY_READ_EXTENSIONS=".pdf" \
  -v /srv/openclaw/workspaces/main:/srv/openclaw/workspaces/main \
  synclaw-fs-bridge
```

## Publish image (example)

```bash
docker tag synclaw-fs-bridge ghcr.io/synclaw/synclaw-fs-bridge:0.1.0
docker push ghcr.io/synclaw/synclaw-fs-bridge:0.1.0
```
