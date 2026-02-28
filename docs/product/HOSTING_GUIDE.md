# Hosting Guide

This guide documents production-style setup for both Cloud and Self-hosted deployment models.

## Navigation

- Cloud hosting:
  - `docs/product/CLOUD_GET_STARTED.md`
- Self-hosted hosting:
  - `docs/product/SELF_HOSTED_PREREQUISITES.md`
  - `docs/product/SELF_HOSTED_SETUP_CONVEX.md`
  - `docs/product/SELF_HOSTED_SETUP_MCP.md`
  - `docs/product/SELF_HOSTED_SETUP_FILES_BRIDGE.md`
  - `docs/product/SELF_HOSTED_RUN_LOCAL.md`
  - `docs/product/SELF_HOSTED_TROUBLESHOOTING.md`
  - environment reference in app docs: `/docs/hosting/environment`

## Hosting model decision

### Choose Cloud when

- you want fastest user onboarding
- you do not want to operate infrastructure
- you want a lower support burden for non-technical users

### Choose Self-hosted when

- you require infra ownership
- you need deployment-level customization
- your team can maintain auth, backend, and integration operations

## OpenClaw Connection Decision Table

1. Public WSS (default):
- Best for most production workspaces.
- Requires `wss://` endpoint, origin allowlist, device approval, and minimum scopes.

2. Private Connector (advanced/private):
- Use only when OpenClaw is private and not exposed publicly.
- Requires running connector runtime on customer-controlled infra.

3. Self-hosted Local (advanced):
- Use only when Synclaw and OpenClaw are in the same local/private environment.
- Browser mixed-content/network rules can block this in HTTPS contexts.

## OpenClaw Security Baseline

1. Add Synclaw origin to `allowedOrigins`.
2. Enforce device approval before chat access.
3. Keep scopes least-privilege.
4. Protect dashboard/admin endpoints with strong auth and network policies.
5. Re-test after every credentials/scope/endpoint change.

## Troubleshooting (OpenClaw)

1. Why `ws://` from `https://` is blocked:
- Browser mixed-content protections block insecure WebSocket from secure origins.
- Use `wss://` or Private Connector.

2. Device approval passes but scopes are still insufficient:
- Re-check role/scopes and rotate token/device scopes for operator actions.

3. Public endpoint hardened but handshake still fails:
- Verify gateway TLS termination, origin allowlist exact match, token/password validity, and workspace-level role/scopes.

## Reference public docs routes

- `/docs/hosting`
- `/docs/hosting/cloud`
- `/docs/hosting/self-hosted`
- `/docs/hosting/self-hosted/convex`
- `/docs/hosting/self-hosted/mcp`
- `/docs/hosting/self-hosted/files-bridge`
- `/docs/hosting/environment`
- `/docs/hosting/webhooks`
- `/docs/hosting/webhooks/security`
- `/docs/hosting/webhooks/providers`
- `/docs/hosting/troubleshooting`
