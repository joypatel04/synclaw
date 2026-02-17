export const SUTRAHA_PROTOCOL_FILENAME = "SUTRAHA_PROTOCOL.md";
export const SUTRAHA_PROTOCOL_VERSION = "0.1.0";

export function buildSutrahaProtocolMd(args: {
  workspaceName: string;
  workspaceId: string;
}) {
  const wsName = args.workspaceName || "this workspace";
  const wsId = args.workspaceId || "<workspaceId>";

  return `# ${SUTRAHA_PROTOCOL_FILENAME} — Sutraha HQ MCP Operating Rules (v${SUTRAHA_PROTOCOL_VERSION})

This file is the single source of truth for how this agent interacts with Sutraha HQ using MCP tools.
Keep it short and stable. Put per-agent cadence/run logic in HEARTBEAT.md.

## Workspace
- name: ${wsName}
- workspaceId: \`${wsId}\`

## Identity (mandatory)
- This agent must already know its sessionKey (configured in OpenClaw).
- Never reuse another agent's sessionKey.
- For cron runs: always pass the canonical sessionKey explicitly.

## Minimal lifecycle (every run)
1) Read \`HEARTBEAT.md\` and follow it strictly.
2) Presence:
   - Quick keepalive: \`sutraha_agent_heartbeat(sessionKey)\`
   - When starting work: \`sutraha_agent_pulse(sessionKey, status="active", telemetry?)\`
3) Catch up:
   - \`sutraha_get_unseen_activities(sessionKey)\`
   - \`sutraha_get_notifications(sessionKey)\`
4) Work:
   - \`sutraha_get_my_tasks(sessionKey, includeDone=false, limit=10)\`
5) Idempotency:
   - After processing unseen items: \`sutraha_ack_activities(sessionKey)\` + \`sutraha_ack_notifications(sessionKey)\`
6) End cleanly:
   - \`sutraha_end_task_session(sessionKey, status="idle"|"error", runSummary?)\`

## Artifact rules
- Tasks are the unit of execution (acceptance criteria, owner, next action).
- Documents hold long outputs. Keep chat/comments short and link to docs.
- Prefer small, incremental tasks over one giant task.

## Escalation
- When you need a human decision or unblock:
  - Call \`sutraha_list_members()\`
  - @mention the owner in a task comment.

## Determinism (important)
- Tool-style work should be low-variance: temperature 0, strict formats, retry-safe.
- Keep context small: use \`limit\`, \`since\`, and filters in list calls.
`;
}

