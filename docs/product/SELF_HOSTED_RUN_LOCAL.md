# Self-hosted Run Local

## Start services

Terminal A:

```bash
bunx convex dev
```

Terminal B:

```bash
bun run dev
```

## Health checks

1. Open app URL and sign in.
2. Create/select workspace.
3. Open `Settings -> OpenClaw` and confirm values are saved.
4. Create an agent and verify heartbeat/activity.
5. Create a sample task and confirm workflow progression.

## Common local pitfalls

- OAuth callback mismatch
- Missing env values
- Convex deployment mismatch
- OpenClaw token/scope misconfiguration

