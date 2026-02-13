# Sutraha HQ - Final Decisions

**Date:** 2026-02-08
**Status:** Ready to Build

---

## Decision Summary

| Question | Decision |
|----------|----------|
| **Auth** | Implement Convex Auth from beginning (secure system) |
| **Notifications** | Agent polling only, no daemon initially |
| **Agent Polling Interval** | 20-30 minutes via `HEARTBEAT_INTERVAL` env var |
| **Agent Count** | 2-3 agents in first month |
| **Linear Migration** | Not needed |
| **Broadcast Targeting** | Default: All agents, but can select specific agents |
| **Task Priorities** | 4 levels sufficient (high/medium/low/none) |
| **Activity Retention** | Display 7 days, data saved forever in Convex |
| **Document Types** | Current 4 types fine (deliverable/research/protocol/note) |
| **Deployment** | Separate Vercel deployment |
| **Access** | Only Joy initially |
| **Built-in Chat** | Add chat interface to talk to agents from Sutraha HQ |

---

## Key Architecture Updates

### 1. Auth Implementation
- Use Convex Auth with GitHub/Google OAuth
- Joy is the only authenticated user initially
- Row Level Security (RLS) to restrict access

### 2. Agent Polling Configuration
Each agent's cron job will read `HEARTBEAT_INTERVAL`:
```bash
# Example cron
npx convex run cron:add \
  --name "jarvis-heartbeat" \
  --schedule '{"kind": "every", "everyMs": 1200000}' \  # 20 min
  --message "Check Sutraha HQ for work"
```

Env var can be set per agent:
```bash
HEARTBEAT_INTERVAL=20  # or 30 for less active agents
```

### 3. Broadcast Targeting
Broadcast creation modal:
- Default toggle: "Send to All Agents" (checked by default)
- Or select specific agents via checkboxes
- Target stored as: `["all"]` or `[agentId1, agentId2, ...]`

### 4. Activity Feed
- Query: `activities.recent` with limit 50
- Display filter: Show only last 7 days
- All data persists in Convex indefinitely

### 5. Built-in Chat Interface
New page: `/chat`
- Chat with specific agent (Jarvis, Shuri, etc.)
- Full message history
- Send to OpenClaw via sessions_send
- Real-time updates

---

## Pages List

| Route | Purpose | Auth Required |
|-------|---------|---------------|
| `/` | Dashboard (agents, kanban, feed) | Yes |
| `/tasks/[id]` | Task detail with comments | Yes |
| `/broadcasts` | Broadcasts list + detail | Yes |
| `/agents` | Agent configuration | Yes |
| `/documents` | Document repository | Yes |
| `/chat` | Built-in agent chat | Yes |
| `/chat/[agentId]` | Chat with specific agent | Yes |
| `/settings` | Account settings | Yes |
| `/login` | Login page | No (redirects if logged in) |

---

## Additional Feature: Built-in Chat

### Chat Architecture

```
┌─────────────────────────────────────────┐
│         Sutraha HQ Chat UI          │
├─────────────────────────────────────────┤
│                                         │
│  Agent Selector:  [▼ Jarvis ▼]          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Jarvis: Hey, what's the status on │  │
│  │ the SEO task?                     │  │
│  │                                   │  │
│  │ You: Just started keyword        │  │
│  │    research.                      │  │
│  │                                   │  │
│  │ Jarvis: Got it. Should be done    │  │
│  │    by tomorrow.                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [ Type a message... ]            [Send] │
└─────────────────────────────────────────┘
```

### Chat Implementation

**Current Approach (WS-only):**
- Chat is rendered directly from OpenClaw Gateway WebSocket events (`chat`/`agent`) in the browser.
- History and tool calls/results are loaded from `chat.history` (OpenClaw), not from Convex.
- Convex does not store chat transcripts (no `chatMessages` / `chatEvents` tables).

**Why:**
- Avoid unbounded growth of Convex documents and bandwidth from streaming deltas.
- OpenClaw is the source of truth for chat history.

---

## Environment Variables

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=https://<your-project>.convex.cloud
CONVEX_DEPLOYMENT=<your-deployment-key>

# Auth (Convex)
NEXT_PUBLIC_CONVEX_AUTH_PROVIDER=github  # or google

# OpenClaw Integration
# Legacy HTTP trigger path (removed): OPENCLAW_GATEWAY_URL

# Agent Configuration (optional)
HEARTBEAT_INTERVAL=20  # Default 20 minutes

# App Configuration
NEXT_PUBLIC_APP_NAME="Sutraha HQ"
NEXT_PUBLIC_APP_URL=https://mission-control.yourdomain.com
```

---

## Deployment Plan

### 1. Convex Setup
```bash
# Create Convex project
npx convex dev

# Deploy schema
npx convex deploy
```

### 2. Vercel Deployment
```bash
# Connect to GitHub repo
# Add environment variables
# Deploy to Vercel
```

### 3. OpenClaw Integration
- Configure OpenClaw Gateway URL in Convex
- Set up webhook triggers for chat messages
- (Optional) Configure CORS for Convex → OpenClaw calls

---

## Next Steps

1. **Review this document** — Confirm all decisions
2. **Use the build prompt** — `BUILD_PROMPT.md` (generated next)
3. **Setup Convex project**
4. **Build with Cursor + Opus**
5. **Deploy to Vercel**
6. **Test with first agent (Jarvis)**

---

_Ready to build!_
