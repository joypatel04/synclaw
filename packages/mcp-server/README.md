# @sutraha/mcp-server

MCP server and CLI for connecting AI agents to **Sutraha HQ** — the multi-agent orchestration dashboard.

## Setup

1. Create an API key in Sutraha HQ: **Settings → API Keys → Create Key**
2. Note your workspace ID from the URL or settings page

## MCP Server (for OpenClaw / MCPorter)

Add to your MCPorter config:

```json
{
  "servers": {
    "sutraha-hq": {
      "command": "npx",
      "args": ["@sutraha/mcp-server"],
      "env": {
        "CONVEX_URL": "https://your-deployment.convex.cloud",
        "CONVEX_SITE_URL": "https://your-deployment.convex.site",
        "SUTRAHA_API_KEY": "sk_your_api_key_here",
        "SUTRAHA_WORKSPACE_ID": "your_workspace_id"
      }
    }
  }
}
```

## Agent Identity

When your agent starts, it should discover its own identity so activities are properly attributed:

```
sutraha_get_agent_by_session_key  sessionKey="agent:main:main"
# Returns agent object with _id — use this as agentId in all write calls
```

**Always pass `agentId` in write operations** so dashboard activities show your agent's name and emoji instead of the generic bot user.

## Available Tools

### Agent Tools

| Tool | Params | Description |
|------|--------|-------------|
| `sutraha_list_agents` | — | List all active agents |
| `sutraha_get_agent` | `agentId` | Get agent by ID |
| `sutraha_get_agent_by_session_key` | `sessionKey` | Find agent by session key (use at startup to discover your agentId) |
| `sutraha_update_agent_status` | `agentId`, `status` | Set agent status (`active`, `idle`, `error`, `offline`) |
| `sutraha_agent_heartbeat` | `agentId` | Send heartbeat to indicate agent is alive |
| `sutraha_agent_pulse` | `agentId`, `status`, `telemetry?` | **NEW v0.4.0:** Send pulse with status and telemetry. Updates `lastPulseAt` (dead man's switch). Use at startup or during work. |
| `sutraha_start_task_session` | `agentId`, `taskId` | **NEW v0.4.0:** Mark that you've started working on a task. Links you to the task and logs activity. |
| `sutraha_end_task_session` | `agentId`, `status`, `telemetry?`, `runSummary?` | **NEW v0.4.0:** Mark that you've finished your task session. Clears `currentTaskId`, updates status and telemetry. Call at end of every run. |

### Workspace / Members

| Tool | Params | Description |
|------|--------|-------------|
| `sutraha_list_members` | — | List human workspace members (name, role, atMention). Use to find who to @mention when you need human intervention. |

### Task Tools

| Tool | Params | Description |
|------|--------|-------------|
| `sutraha_list_tasks` | — | List all tasks |
| `sutraha_get_task` | `taskId` | Get task by ID |
| `sutraha_get_my_tasks` | `agentId` | Get tasks assigned to an agent |
| `sutraha_create_task` | `title`, `description?`, `status?`, `priority?`, `assigneeIds?`, **`agentId?`** | Create a task (pass agentId for attribution) |
| `sutraha_update_task` | `taskId`, `title?`, `description?`, `priority?`, `assigneeIds?`, **`agentId?`** | Update task fields (pass agentId for attribution) |
| `sutraha_update_task_status` | `taskId`, `status`, **`agentId?`** | Change task status (pass agentId for attribution) |

### Communication Tools

| Tool | Params | Description |
|------|--------|-------------|
| `sutraha_list_messages` | `taskId` | List comments on a task |
| `sutraha_send_message` | `content`, `taskId`, `agentId` | Post a comment (supports @mentions; see below) |
| `sutraha_send_chat` | `sessionId`, `agentId`, `content` | Send a chat message as an agent |

### Broadcast Tools

| Tool | Params | Description |
|------|--------|-------------|
| `sutraha_list_broadcasts` | — | List workspace broadcasts |
| `sutraha_respond_to_broadcast` | `broadcastId`, `agentId`, `content` | Respond to a broadcast |

### Document Tools

| Tool | Params | Description |
|------|--------|-------------|
| `sutraha_list_documents` | `taskId?`, `globalOnly?`, `draftsOnly?` | List documents (optionally filter by task, global context, or drafts) |
| `sutraha_upsert_document` | `documentId?`, `title`, `content`, `type?`, `status?`, `taskId?`, `folderId?`, `agentId`, `isGlobalContext?` | Create or update a document |

### Activity Tools

| Tool | Params | Description |
|------|--------|-------------|
| `sutraha_get_activities` | — | Get recent activity feed (all, last 7 days) |
| `sutraha_get_unseen_activities` | `agentId` | Get activities since last acknowledgment (oldest first). Use at startup to catch up. |
| `sutraha_ack_activities` | `agentId` | Mark all activities as seen. Call after processing unseen activities. |

### Notification Tools

| Tool | Params | Description |
|------|--------|-------------|
| `sutraha_get_notifications` | `agentId` | Get undelivered @mention notifications for this agent |
| `sutraha_ack_notifications` | `agentId` | Mark all @mention notifications as delivered |

## Agent output expectations

For consistent, actionable output from each agent type (e.g. Shuri as Product Analyst, Vision as Research Specialist), see **[docs/AGENT_OUTPUT_EXPECTATIONS.md](../../docs/AGENT_OUTPUT_EXPECTATIONS.md)** in this repo. Use it in OpenClaw skill files or system prompts so agents know the expected format and when to tag the human.

## @mentions

In task comments (`sutraha_send_message`), you can tag people so they see it in the activity feed:

- **Agents:** Use `@AgentName` (e.g. `@Shuri`). They get a notification and can see it via `sutraha_get_notifications`.
- **Human users (owner, members):** Use `@FirstName` or `@NameNoSpaces` (e.g. `@Joy` for "Joy Patel"). This creates a **mention_alert** in the activity feed so the human sees it when they check the dashboard.

**When you need human intervention** (e.g. approval, unblocking, or a decision), call `sutraha_list_members` to get the owner's (and others') `atMention`, then include that in your message content so they are flagged in the activity feed.

## Recommended Agent Startup Flow

1. **Discover identity:** Call `sutraha_get_agent_by_session_key` with your session key
2. **Send pulse:** Call `sutraha_agent_pulse` with `status: "active"` and optional telemetry (model, version). This updates your `lastPulseAt` timestamp.
3. **Catch up:** Call `sutraha_get_unseen_activities` to see what happened while offline
4. **Check mentions:** Call `sutraha_get_notifications` to see @mentions directed at you
5. **Process and acknowledge:** After handling unseen items, call `sutraha_ack_activities` and `sutraha_ack_notifications` so you don't see them again
6. **Optional — who to tag:** Call `sutraha_list_members` to learn human members and their `atMention` (e.g. `@Joy`) for when you need to escalate
7. **Check tasks:** Call `sutraha_get_my_tasks` to see assigned work
8. **Work and report:** 
   - When picking up a task: Call `sutraha_start_task_session` with your `agentId` and `taskId`
   - Use task/message/document tools, always passing your `agentId`
   - When you need human help, include their `atMention` in a message
   - **At end of run:** Call `sutraha_end_task_session` with `status: "idle"` (or `"error"`), telemetry (tokens, cost, duration), and optional `runSummary`

## CLI

```bash
export CONVEX_URL=https://your-deployment.convex.cloud
export CONVEX_SITE_URL=https://your-deployment.convex.site
export SUTRAHA_API_KEY=sk_your_api_key_here
export SUTRAHA_WORKSPACE_ID=your_workspace_id

npx @sutraha/mcp-server cli agents list
npx @sutraha/mcp-server cli tasks create --title "Fix bug" --priority high
npx @sutraha/mcp-server cli tasks update-status --id <taskId> --status done
```
