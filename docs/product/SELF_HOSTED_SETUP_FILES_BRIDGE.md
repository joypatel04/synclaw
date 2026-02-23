# Self-hosted Setup: OpenClaw Files Bridge

Use this when you want Sutraha HQ to browse and edit files in a remote OpenClaw workspace directory.

## Why this exists

Browser-only editing cannot safely access arbitrary remote server directories.  
The Files Bridge runs on your server and exposes a controlled API for text files.

## v1 capabilities

- Browse directory tree
- Read/write text files:
  - `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`, `.config`
- Root path jail (single workspace root)
- Token-based auth

## Run bridge (Docker)

```bash
cd packages/fs-bridge
docker build -t sutraha-fs-bridge .

docker run --rm -p 8787:8787 \
  -e FS_BRIDGE_TOKEN="replace_me" \
  -e WORKSPACE_ROOT_PATH="/srv/openclaw/workspaces/main" \
  -e FS_MAX_FILE_BYTES="1048576" \
  -e FS_ALLOWED_EXTENSIONS=".md,.txt,.json,.yaml,.yml,.toml,.config,.js,.jsx,.mjs,.ts,.tsx" \
  -v /srv/openclaw/workspaces/main:/srv/openclaw/workspaces/main \
  sutraha-fs-bridge
```

## Configure Sutraha HQ

1. Set `NEXT_PUBLIC_OPENCLAW_FILES_ENABLED=true`.
2. Open `/filesystem`.
3. Enable Files Bridge.
4. Enter bridge URL + workspace root path.
5. Set bridge token and save.
6. Test bridge and open files in the remote panel.

## Multi-user note

Each self-hosted customer can set their own `WORKSPACE_ROOT_PATH` based on their server layout.  
Sutraha HQ uses per-workspace bridge config, so this works across different customer environments.
