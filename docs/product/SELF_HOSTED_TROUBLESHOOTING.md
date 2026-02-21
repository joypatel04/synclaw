# Self-hosted Troubleshooting

## Auth loop or callback issues

- Recheck OAuth callback URL and app URL alignment.
- Confirm provider credentials are loaded in env.
- Verify local/prod host mismatch is not causing redirects.

## Convex route / auth errors

- Ensure Convex deployment variables are correct.
- Confirm Convex functions are running and updated.
- Re-run `bunx convex dev` if local sync got stale.

## OpenClaw connection errors

- Verify gateway URL/token/scopes.
- Confirm workspace-level OpenClaw settings are populated.
- Validate upstream gateway health.

## Missing heartbeat/activity

- Confirm session key and heartbeat cadence setup.
- Verify agent setup files and scheduler path.
- Check that heartbeat updates are being written.

## MCP tool failures

- Validate MCP server availability and auth.
- Confirm expected tool names and input schema.
- Review logs for timeouts or permission denials.

