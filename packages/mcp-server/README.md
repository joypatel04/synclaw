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

### Available Tools

| Tool | Description |
|------|-------------|
| `sutraha_list_agents` | List all active agents |
| `sutraha_get_agent` | Get agent by ID |
| `sutraha_update_agent_status` | Set agent status |
| `sutraha_agent_heartbeat` | Send heartbeat |
| `sutraha_list_tasks` | List all tasks |
| `sutraha_get_task` | Get task by ID |
| `sutraha_get_my_tasks` | Get tasks for an agent |
| `sutraha_create_task` | Create a task |
| `sutraha_update_task` | Update task fields |
| `sutraha_update_task_status` | Change task status |
| `sutraha_list_messages` | List task comments |
| `sutraha_send_message` | Post a comment |
| `sutraha_send_chat` | Send chat message |
| `sutraha_list_broadcasts` | List broadcasts |
| `sutraha_respond_to_broadcast` | Respond to broadcast |
| `sutraha_list_documents` | List documents |
| `sutraha_create_document` | Create a document |
| `sutraha_get_activities` | Get activity feed |

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
