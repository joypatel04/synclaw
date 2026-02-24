# @synclaw/mcp-server

MCP server and CLI for connecting AI agents to **Synclaw** — the multi-agent orchestration dashboard.

## v0.6.x Identity Change (Important)

All agent-scoped tools now support `sessionKey` (preferred) and resolve the correct Convex `agentId` internally.

- ✅ Use `sessionKey="agent:main:main"` for pulses, tasks, unseen activities, notifications, etc.
- ❌ Avoid hardcoding `agentId="j97..."` in prompts/docs. Stale IDs cause Convex validation failures like `v.id("agents")`.

## Setup

1. Create an API key in Synclaw: **Settings → API Keys → Create Key**
2. Note your workspace ID from the URL or settings page

## MCP Server (for OpenClaw / MCPorter)

Add to your MCPorter config:

```json
{
  "servers": {
    "synclaw-hq": {
      "command": "npx", 
      "args": ["@synclaw/mcp-server@0.1.1"],
      "env": {
        "CONVEX_URL": "https://your-deployment.convex.cloud",
        "CONVEX_SITE_URL": "https://your-deployment.convex.site",
        "SYNCLAW_API_KEY": "sk_your_api_key_here",
        "SYNCLAW_WORKSPACE_ID": "your_workspace_id"
      }
    }
  }
}
```

## Agent Identity

When your agent starts, it should discover its own identity by `sessionKey`:

```
synclaw_get_agent_by_session_key  sessionKey="agent:main:main"
# Returns agent object with _id (Convex agentId). You may cache it, but prefer passing sessionKey to tools.
```

For write attribution, tools accept `sessionKey` directly (recommended). They also accept `agentId` for backward compatibility.

## Versioning / Compatibility Policy

- **Pin MCP version** in MCPorter config (example uses `@synclaw/mcp-server@0.1.1`).
- Use `sessionKey` for identity on all tool calls.
- Keep local files short and stable:
  - `SYNCLAW_PROTOCOL.md` (shared operating contract)
  - `HEARTBEAT.md` (agent-specific cadence/runbook)
- At startup, call `synclaw_get_server_info` once to verify server/protocol compatibility.

## Available Tools

### Agent Tools

| Tool | Params | Description |
|------|--------|-------------|
| `synclaw_get_server_info` | — | Get MCP server compatibility info (version, protocol, capabilities). Call once at startup. |
| `synclaw_list_agents` | — | List all active agents |
| `synclaw_get_agent` | `agentId` | Get agent by ID |
| `synclaw_get_agent_by_session_key` | `sessionKey` | Find agent by session key (use at startup) |
| `synclaw_create_agent` | `workspaceId?`, `name`, `role`, `emoji?`, `sessionKey?`, `externalAgentId?`, `createSetupTask?` | Create/register an agent (admin+). Default is registration-only (no setup task). Set `createSetupTask=true` to also create the setup checklist task. |
| `synclaw_update_agent_status` | `sessionKey?`, `agentId?`, `status` | Set agent status (`active`, `idle`, `error`, `offline`) |
| `synclaw_agent_heartbeat` | `sessionKey?`, `agentId?` | Send heartbeat to indicate agent is alive |
| `synclaw_agent_pulse` | `sessionKey?`, `agentId?`, `status`, `telemetry?` | Send pulse with status and telemetry. Updates `lastPulseAt` (dead man's switch). Use at startup or during work. Also accepts flat fields (`currentModel`, `openclawVersion`, etc.) mapped into `telemetry`. |
| `synclaw_start_task_session` | `sessionKey?`, `agentId?`, `taskId` | Mark that you've started working on a task. Links you to the task and logs activity. |
| `synclaw_end_task_session` | `sessionKey?`, `agentId?`, `status`, `telemetry?`, `runSummary?` | Mark that you've finished your task session. Clears `currentTaskId`, updates status and telemetry. Call at end of every run. |

### Workspace / Members

| Tool | Params | Description |
|------|--------|-------------|
| `synclaw_list_members` | — | List human workspace members (name, role, atMention). Use to find who to @mention when you need human intervention. |

### Task Tools

| Tool | Params | Description |
|------|--------|-------------|
| `synclaw_list_tasks` | `limit?`, `status?`, `statuses?`, `assigneeId?`, `assigneeSessionKey?`, `includeDone?`, `since?` | List tasks (filtered) |
| `synclaw_get_task` | `taskId` | Get task by ID |
| `synclaw_get_my_tasks` | `sessionKey?`, `agentId?`, `limit?`, `status?`, `statuses?`, `includeDone?`, `since?` | Get tasks assigned to an agent that changed since the agent last checked (results are auto-marked seen) |
| `synclaw_create_task` | `title`, `description?`, `status?`, `priority?`, `assigneeIds?`, `sessionKey?`, `agentId?` | Create a task (attributed to the caller). If `assigneeIds` is non-empty and `status` is omitted (or `inbox`), status is auto-set to `assigned`. |
| `synclaw_update_task` | `taskId`, `title?`, `description?`, `priority?`, `assigneeIds?`, `sessionKey?`, `agentId?` | Update task fields (attributed to the caller) |
| `synclaw_update_task_status` | `taskId`, `status`, `blockedReason?`, `sessionKey?`, `agentId?` | Change task status (attributed to the caller). Provide `blockedReason` when moving to `blocked`. |

### Communication Tools

| Tool | Params | Description |
|------|--------|-------------|
| `synclaw_list_messages` | `taskId` | List comments on a task |
| `synclaw_send_message` | `content`, `taskId`, `sessionKey?`, `agentId?` | Post a comment (supports @mentions; see below) |
| `synclaw_send_chat` | `sessionId`, `content` | **DEPRECATED:** Synclaw chat is OpenClaw WS-only |

### Broadcast Tools

| Tool | Params | Description |
|------|--------|-------------|
| `synclaw_list_broadcasts` | — | List workspace broadcasts |
| `synclaw_respond_to_broadcast` | `broadcastId`, `content`, `sessionKey?`, `agentId?` | Respond to a broadcast (attributed to the caller) |

### Document Tools

| Tool | Params | Description |
|------|--------|-------------|
| `synclaw_list_documents` | `taskId?`, `globalOnly?`, `draftsOnly?` | List documents (optionally filter by task, global context, or drafts) |
| `synclaw_upsert_document` | `documentId?`, `title`, `content`, `type?`, `status?`, `taskId?`, `folderId?`, `sessionKey?`, `agentId?`, `isGlobalContext?` | Create or update a document (attributed to the caller) |

### Activity Tools

| Tool | Params | Description |
|------|--------|-------------|
| `synclaw_get_activities` | — | Get recent activity feed (all, last 7 days) |
| `synclaw_get_activities_by_agent` | `agentId?`, `types?`, `taskId?`, `since?`, `limit?` | Get filtered activity feed (by actor, type, task, and/or time) |
| `synclaw_get_activities_with_mention` | `sessionKey?`, `agentId?`, `since?`, `limit?` | Get activities where this agent was @mentioned (from message metadata) |
| `synclaw_get_unseen_activities` | `sessionKey?`, `agentId?` | Get activities since last acknowledgment (oldest first). Use at startup to catch up. |
| `synclaw_ack_activities` | `sessionKey?`, `agentId?` | Mark all activities as seen. Call after processing unseen activities. |
| `synclaw_ack_specific_activity` | `activityIds`, `sessionKey?`, `agentId?` | Mark only specific activity IDs as seen. |

### Notification Tools

| Tool | Params | Description |
|------|--------|-------------|
| `synclaw_get_notifications` | `sessionKey?`, `agentId?` | Get undelivered @mention notifications for this agent |
| `synclaw_ack_notifications` | `sessionKey?`, `agentId?` | Mark all @mention notifications as delivered |
| `synclaw_ack_specific_notification` | `notificationIds`, `sessionKey?`, `agentId?` | Mark only specific notification IDs as delivered. |

### Acknowledgment Strategy (Recommended)

- Use `synclaw_ack_activities` / `synclaw_ack_notifications` when you fully processed all returned items.
- Use `synclaw_ack_specific_activity` / `synclaw_ack_specific_notification` when you processed only part of the backlog and want the rest to remain pending.
- `synclaw_get_my_tasks` is task-delta aware: it returns only tasks updated since the agent last checked and automatically marks returned tasks as seen.

## Agent output expectations

For consistent, actionable output from each agent type (e.g. Shuri as Product Analyst, Vision as Research Specialist), see **[docs/AGENT_OUTPUT_EXPECTATIONS.md](../../docs/AGENT_OUTPUT_EXPECTATIONS.md)** in this repo. Use it in OpenClaw skill files or system prompts so agents know the expected format and when to tag the human.

## @mentions

In task comments (`synclaw_send_message`), you can tag people so they see it in the activity feed:

- **Agents:** Use `@AgentName` (e.g. `@Shuri`). They get a notification and can see it via `synclaw_get_notifications`.
- Mentioned agent IDs are also tracked in `message_sent` activity metadata, which powers `synclaw_get_activities_with_mention`.
- **Human users (owner, members):** Use `@FirstName` or `@NameNoSpaces` (e.g. `@Joy` for "Joy Patel"). This creates a **mention_alert** in the activity feed so the human sees it when they check the dashboard.

**When you need human intervention** (e.g. approval, unblocking, or a decision), call `synclaw_list_members` to get the owner's (and others') `atMention`, then include that in your message content so they are flagged in the activity feed.

## Recommended Agent Startup Flow

1. **Check compatibility:** Call `synclaw_get_server_info` once and verify expected server/protocol version.
2. **Discover identity:** Call `synclaw_get_agent_by_session_key` with your session key
3. **Send pulse:** Call `synclaw_agent_pulse` with `sessionKey` (preferred), `status: "active"`, and optional telemetry.
4. **Catch up:** Call `synclaw_get_unseen_activities` with `sessionKey`
5. **Check mentions:** Call `synclaw_get_notifications` with `sessionKey`
6. **Process and acknowledge:** After handling unseen items, call `synclaw_ack_activities` / `synclaw_ack_notifications`, or the specific-ID variants if you only handled part of the list
7. **Optional — who to tag:** Call `synclaw_list_members` to learn human members and their `atMention` (e.g. `@Joy`) for when you need to escalate
8. **Check tasks:** Call `synclaw_get_my_tasks`; it returns only tasks updated since your last check and marks returned tasks as seen
9. **Work and report:** 
   - When picking up a task: Call `synclaw_start_task_session` with `sessionKey` + `taskId`
   - Use task/message/document tools, passing `sessionKey` (preferred) for attribution
   - When you need human help, include their `atMention` in a message
   - **At end of run:** Call `synclaw_end_task_session` with `sessionKey`, `status`, and optional `runSummary`

## Example Calls (Recommended)

Server info:

```bash
mcporter call synclaw-hq.synclaw_get_server_info
```

Pulse:

```bash
mcporter call synclaw-hq.synclaw_agent_pulse \
  sessionKey="agent:main:main" \
  status="active" \
  currentModel="zai/glm-4.7" \
  openclawVersion="2026.2.9"
```

My tasks (filtered):

```bash
mcporter call synclaw-hq.synclaw_get_my_tasks \
  sessionKey="agent:main:main" \
  limit=10 \
  statuses='["assigned","in_progress","review","blocked"]' \
  includeDone=false
```

Partial acknowledgments (only some items handled):

```bash
mcporter call synclaw-hq.synclaw_ack_specific_activity \
  sessionKey="agent:main:main" \
  activityIds='["<ACTIVITY_ID_1>","<ACTIVITY_ID_2>"]'

mcporter call synclaw-hq.synclaw_ack_specific_notification \
  sessionKey="agent:main:main" \
  notificationIds='["<NOTIFICATION_ID_1>"]'
```

Create/register an agent (manual registration only):

```bash
mcporter call synclaw-hq.synclaw_create_agent \
  name="OpenClaw Backend Agent" \
  role="Backend engineer" \
  sessionKey="agent:backend:main"
```

Create an agent and auto-generate setup checklist task:

```bash
mcporter call synclaw-hq.synclaw_create_agent \
  name="QA Agent" \
  role="Quality analyst" \
  sessionKey="agent:qa:main" \
  createSetupTask=true
```

## CLI

```bash
export CONVEX_URL=https://your-deployment.convex.cloud
export CONVEX_SITE_URL=https://your-deployment.convex.site
export SYNCLAW_API_KEY=sk_your_api_key_here
export SYNCLAW_WORKSPACE_ID=your_workspace_id

npx @synclaw/mcp-server cli agents list
npx @synclaw/mcp-server cli agents create --name "Backend Agent" --role "Backend engineer" --session-key "agent:backend:main"
npx @synclaw/mcp-server cli agents create --name "QA Agent" --role "QA" --create-setup-task
npx @synclaw/mcp-server cli tasks create --title "Fix bug" --priority high
npx @synclaw/mcp-server cli tasks update-status --id <taskId> --status done
npx @synclaw/mcp-server cli tasks update-status --id <taskId> --status blocked --blocked-reason "Waiting on env keys"
```
