# AGENTS.md — Synclaw Agent Orchestration

**Last Updated:** 2026-02-24 (All 7 Agents Active)

---

## Overview

Jarvis, Shuri, Ancient One, Vision, Friday, Wanda, and Nick Fury connect to Synclaw via MCP server (`@synclaw/mcp-server`). This enables multi-agent collaboration on shared tasks with proper activity attribution.

---

## Agent Identity

| Agent | Session Key | Role | Emoji | Agent ID | Workspace |
|--------|-------------|------|--------|----------|-----------|
| Jarvis | `agent:main:main` | Squad Lead | 🦊 | `j973g1r1rr1e5ntvd4tegq9k4x80s560` | `~/.openclaw/workspace` |
| Shuri | `agent:shuri:main` | Product Analyst | 🔬 | `j972sahxmcn8ptk241qjqrm9jd80rata` | `~/.openclaw/workspace-shuri` |
| Ancient One | `agent:ancient-one:main` | Research Specialist | 🧙‍♂️ | `j977fwnfr4fdjq8m9v2v6ayk1180rjbc` | `~/.openclaw/workspace-ancient-one` |
| Vision | `agent:vision:main` | SEO & Discovery | 💡 | `j97c3rf071xqqp0p74jj1rtxcx8100tz` | `~/.openclaw/workspace-vision` |
| Friday | `agent:friday:main` | Frontend Code Assistant | 🧪 | `j977qkm5wpchy9y9nwrny5bb1h81cv1b` | `~/.openclaw/workspace-friday` |
| Wanda | `agent:wanda:main` | Content Writer | 🔮 | `j975atr2qhw57rjtr8qqpff6xd81mjax` | `~/.openclaw/workspace-wanda` |
| Nick Fury | `agent:nick-fury:main` | Operations Manager | 🛡 | `j9760p2syas9sq0qb0qcrdaz7181nb76` | `~/.openclaw/workspace-nick-fury` |

---

## Nick Fury (🛡) — Operations Manager / Monitoring Agent

**NEW:** Nick Fury is now part of Sutraha agent squad as Operations Manager / Monitoring Agent.

### Expertise

| Area | What Nick Fury Does |
|-------|-----------------|
| **Webhook Monitoring** | Track delivery success/failure from vyana-web → Synclaw |
| **System Uptime** | Pulse check every 5-10 minutes — Synclaw availability |
| **Webhook Retry Logic** | Alert on 3+ failures in 10 minutes |
| **Payload Validation** | Ensure webhook data is valid before processing |
| **Webhook Timeout** | Alert if no delivery acknowledgement in 30 seconds |
| **Daily Sync Checks** | Profile consistency, task status sync, data integrity |
| **Alert Thresholds** | Webhook failures > 3/min, Uptime < 95%, Sync mismatches > 10 |

### How to Work With Nick Fury

```bash
# Daily pulse
mcporter call synclaw-hq.synclaw_agent_pulse sessionKey: "agent:nick-fury:main" status="active" \
  telemetry='{"currentModel":"zai/glm-4.7","openclawVersion":"2026.2.12"}'

# Daily metrics pull
mcporter call synclaw-hq.synclaw_get_my_tasks sessionKey: "agent:nick-fury:main" \
  includeDone=false limit=10
```

---

## Friday Query Protocol

**NEW:** All agents can query Friday for codebase/product state without Friday making changes.

See: `FRIDAY_QUERY_PROTOCOL.md` for:
- When to query Friday
- Query templates
- Friday's response format
- Example interactions

**Quick usage:**
```bash
# From any agent
sessions_send sessionKey: "agent:friday:main" \
  message="QUERY: What is the current implementation of [feature]?"
```

---

## Shared Tools & Capabilities

All agents have access to the following shared tools via `mcporter`:

| Tool | Usage | Best For |
|------|--------|----------|
| `lightpanda-scrape` | `lightpanda-scrape.scrape_page`, `lightpanda-scrape.list_links` | Dynamic sites, SPAs, and any **sutraha.in** URLs (session-persistent). |
| `web_fetch` | `web_fetch(url)` | Static documentation, fast text extraction, non-JS sites. |
| `mcporter` | `mcporter call <selector>` | Direct access to all configured MCP servers. |

## Synclaw Interaction Protocol

**STRICT:** All agents MUST follow the **Mandatory Agent Workflow** and **Tool Call Syntax** defined in `SYNCLAW_HQ_PROTOCOL.md` (v1.2.0).

- **Stage 1:** Presence (Pulse)
- **Stage 2:** Triage & Specific Ack (MANDATORY: No Bulk Ack)
- **Stage 3:** Task Pickup
- **Stage 4:** Execution (incl. Friday Query Protocol)
- **Stage 5:** Resolution & Telemetry

See `SYNCLAW_HQ_PROTOCOL.md` for exact syntax and telemetry requirements.

---

## Memory Tier Protocol

**CRITICAL:** All agents MUST follow the **Memory Tier Strategy** defined in `MEMORY_PROTOCOL.md`.

| Tier | Source | Cost |
|------|--------|------|
| **Tier 1** | Local `read` | 0 |
| **Tier 2** | PageIndex API | 1 |
| **Tier 3** | Chat History | 0 |

See `MEMORY_PROTOCOL.md` for full rules and `doc_id` list.

---

## Workspace Directory Structure

- **Main Workspace**: `/root/.openclaw/workspace`
- **Memory Store**: `/root/.openclaw/workspace/memory/`
- **Synclaw Integration**: `synclaw-hq` (MCP)

---

## Agent Squad (Complete)

| Agent | Session Key | Role | Emoji |
|-------|--------|--------|--------|
| Jarvis | `agent:main:main` | Squad Lead | 🦊 |
| Shuri | `agent:shuri:main` | Product Analyst | 🔬 |
| Ancient One | `agent:ancient-one:main` | Research Specialist | 🧙‍♂️ |
| Vision | `agent:vision:main` | SEO & Discovery | 💡 |
| Friday | `agent:friday:main` | Frontend Code Assistant | 🧪 |
| Wanda | `agent:wanda:main` | Content Writer | 🔮 |
| Nick Fury | `agent:nick-fury:main` | Operations Manager | 🛡 |

---

## Agent Status Flow

| Status | Meaning |
|--------|---------|
| `inbox` | New, not started |
| `assigned` | Assigned to someone |
| `in_progress` | Being worked on |
| `review` | Ready for review |
| `done` | Completed |
| `blocked` | Blocked by something |

---

## Priority Values

| Priority | When to use |
|----------|-------------|
| `high` | Urgent, blocking |
| `medium` | Normal work |
| `low` | Nice to have |
| `none` | Default |

---

## Agent Status Values

| Status | Meaning |
|--------|---------|
| `active` | Agent is working |
| `idle` | Agent is available but not working |
| `error` | Agent encountered an error |
| `offline` | Agent is offline |

---

## Idempotency / Seen-State Rules (STRICT)

**Goal:** Never reprocess the same backlog items. Process then acknowledge *specifically*.

### How to implement:

1. **Fetch unseen items:**
   ```bash
   mcporter call synclaw-hq.synclaw_get_unseen_activities sessionKey="<your-session-key>"
   mcporter call synclaw-hq.synclaw_get_notifications sessionKey="<your-session-key>"
   ```

2. **Process/Delegate:** Group activities by `taskId`. For each group, spawn a worker or process.

3. **Specific Acknowledgment (MANDATORY):**
   **NEVER** use `synclaw_ack_activities` or `synclaw_ack_notifications` (Bulk Ack). These are deprecated and cause data loss (e.g., Wanda bug Feb 24).
   
   **ALWAYS** use:
   ```bash
   mcporter call synclaw-hq.synclaw_ack_specific_activity \
     activityIds=["id1", "id2"] \
     sessionKey="<your-session-key>"

   mcporter call synclaw-hq.synclaw_ack_specific_notification \
     notificationIds=["id1", "id2"] \
     sessionKey="<your-session-key>"
   ```

---

## Failure Handling

If an MCP tool call returns `Server Error`:
- Retry once with corrected args.
- If still failing, report failure in a task comment (include Request ID if present) and stop writing until resolved.

---

## Human Tagging Protocol

When an agent needs human intervention (approval, decision, unblock):

**Get human members:**
```bash
mcporter call 'synclaw-hq.synclaw_list_members()'
```

**Tag human in message:**
```bash
# Tag in chat message
mcporter call 'synclaw-hq.synclaw_send_chat(content: "@Joy need your review on this task", sessionKey: "<sessionKey>")'

# Or reply to task
mcporter call 'synclaw-hq.synclaw_send_message(taskId: "...", content: "@Joy ready for your decision", sessionKey: "<sessionKey>")'
```

---

## @mentions (In Task Comments)

In task comments (`synclaw_send_message`), you can tag people so they see it in the activity feed:

- **Agents:** Use `@AgentName` (e.g. `@Shuri`). They get a notification and can see it via `synclaw_get_notifications`.
- **Human users (owner, members):** Use `@FirstName` or `@NameNoSpaces` (e.g. `@Joy` for "Joy Patel"). This creates a **mention_alert** in the activity feed so the human sees it when they check the dashboard.

---

## Recommended Agent Startup Flow

1. **Discover identity:** Call `synclaw_get_agent_by_session_key` with your session key
2. **Send pulse:** Call `synclaw_agent_pulse` with `status: "active"` and optional telemetry (model, version). This updates your `lastPulseAt` timestamp.
3. **Catch up:** Call `synclaw_get_unseen_activities` to see what happened while offline
4. **Check mentions:** Call `synclaw_get_notifications` to see @mentions directed at you
5. **Process and acknowledge SPECIFICALLY:** After handling unseen items, call `synclaw_ack_specific_activity` and `synclaw_ack_specific_notification` with the relevant IDs. **NEVER** use bulk ack tools (`synclaw_ack_activities` / `synclaw_ack_notifications`).
6. **Optional — who to tag:** Call `synclaw_list_members` to learn human members and their `atMention` (e.g. `@Joy`) for when you need to escalate
7. **Check tasks:** Call `synclaw_get_my_tasks` to see assigned work
8. **Work and report:**
   - When picking up a task: Call `synclaw_start_task_session` with your `sessionKey` and `taskId`
   - Use task/message/document tools, always passing your `sessionKey` (or `sessionKey` as fallback)
   - When you need human help, include their `atMention` in a message
   - **At end of run:** Call `synclaw_end_task_session` with `status: "idle"` (or `"error"`), telemetry (tokens, cost, duration), and optional `runSummary`

---

## About This File

**Purpose:** Centralized protocol for Synclaw MCP tools

**Benefits:**
- Single source of truth for all agents
- No need to fetch protocol from Synclaw repeatedly (saves ~4 GB/day read bandwidth)
- All agents use same startup sequence
- Easy to update protocol (one file vs four)

**Version:** v0.6.5 — 2026-02-24 (verified: installed package @synclaw/mcp-server@0.1.1)

**What's new in v0.6.5:**
- All features from v0.6.2 remain fully supported
- Enhanced stability and performance improvements
- Updated MCP protocol compatibility to match @synclaw/mcp-server@0.1.1
- Bug fixes and minor protocol refinements

---

_This is the master protocol document. All agents should use this as their reference._
