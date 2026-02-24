import { SYNCLAW_MCP_SERVER_VERSION } from "@/lib/mcpServerSpec";

export const SYNCLAW_PROTOCOL_FILENAME = "SYNCLAW_PROTOCOL.md";
export const SYNCLAW_PROTOCOL_VERSION = "0.1.2";

export function buildSynclawProtocolMd(args: {
  workspaceName: string;
  workspaceId: string;
}) {
  const wsName = args.workspaceName || "this workspace";
  const wsId = args.workspaceId || "<workspaceId>";

  return `# ${SYNCLAW_PROTOCOL_FILENAME} — Synclaw MCP Operating Rules (v${SYNCLAW_PROTOCOL_VERSION})

This file is the single source of truth for how this agent interacts with Synclaw using MCP tools.
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
2) Compatibility check (once per startup):
   - Call: \`synclaw_get_server_info()\`
   - Confirm MCP server version is pinned (recommended: \`${SYNCLAW_MCP_SERVER_VERSION}\`).
3) Presence:
   - Quick keepalive: \`synclaw_agent_heartbeat(sessionKey)\`
   - When starting work: \`synclaw_agent_pulse(sessionKey, status="active", telemetry?)\`
4) Catch up:
   - \`synclaw_get_unseen_activities(sessionKey)\`
   - \`synclaw_get_notifications(sessionKey)\`
5) Work:
   - \`synclaw_get_my_tasks(sessionKey, includeDone=false, limit=10)\`
   - Note: this returns only tasks updated since this agent last checked and auto-marks returned tasks as seen.
   - If work is blocked, set status with reason:
     \`synclaw_update_task_status(taskId, status="blocked", blockedReason="...")\`
6) Idempotency:
   - If all unseen items were handled:
     \`synclaw_ack_activities(sessionKey)\` + \`synclaw_ack_notifications(sessionKey)\`
   - If only some were handled:
     \`synclaw_ack_specific_activity(activityIds, sessionKey)\` + \`synclaw_ack_specific_notification(notificationIds, sessionKey)\`
7) End cleanly:
   - \`synclaw_end_task_session(sessionKey, status="idle"|"error", runSummary?)\`

## Artifact rules
- Tasks are the unit of execution (acceptance criteria, owner, next action).
- Documents hold long outputs. Keep chat/comments short and link to docs.
- Prefer small, incremental tasks over one giant task.

## Escalation
- When you need a human decision or unblock:
  - Call \`synclaw_list_members()\`
  - @mention the owner in a task comment.

## Determinism (important)
- Tool-style work should be low-variance: temperature 0, strict formats, retry-safe.
- Keep context small: use \`limit\`, \`since\`, and filters in list calls.
`;
}
