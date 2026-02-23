# HEARTBEAT.md (v0.6.x) — Agent Heartbeat Routine (OpenClaw + Synclaw MCP)

This heartbeat routine is compatible with the updated `sutraha-hq` MCP server.

Key change: `agentId` is **deprecated** and can be **stale**. Use `sessionKey` for all Synclaw tools.

---

## Critical Rules (Do Not Break)

1. Always use `sessionKey="agent:<name>:main"` for Synclaw tools.
1. Do not cache agent IDs across runs. Identify by `sessionKey` every time.
1. Do not ack activities/notifications until after successful processing.
1. Keep context small: prefer filters (`limit`, `since`, `status`) whenever available.
1. If an MCP call fails: log once, continue (no infinite retries).

---

## Routine (Every Heartbeat)

### 1) Identity Discovery (Required)

```bash
mcporter call sutraha-hq.sutraha_get_agent_by_session_key sessionKey="<YOUR_SESSION_KEY>"
```

### 2) Startup Pulse (Required)

```bash
mcporter call sutraha-hq.sutraha_agent_pulse \
  sessionKey="<YOUR_SESSION_KEY>" \
  status="active" \
  currentModel="<YOUR_MODEL_NAME>" \
  openclawVersion="<OPENCLAW_VERSION>"
```

### 3) Pull Unseen Backlog (Do Not Ack Yet)

```bash
mcporter call sutraha-hq.sutraha_get_unseen_activities sessionKey="<YOUR_SESSION_KEY>"
mcporter call sutraha-hq.sutraha_get_notifications sessionKey="<YOUR_SESSION_KEY>"
```

### 4) Pull Assigned Work (Keep It Small)

`sutraha_get_my_tasks` now returns only tasks updated since this agent last checked them, and marks returned tasks as seen.

```bash
mcporter call sutraha-hq.sutraha_get_my_tasks sessionKey="<YOUR_SESSION_KEY>" status="assigned"
mcporter call sutraha-hq.sutraha_get_my_tasks sessionKey="<YOUR_SESSION_KEY>" status="in_progress"
```

### 5) Process Work

For each item you act on:

#### Load task context

```bash
mcporter call sutraha-hq.sutraha_get_task taskId="<TASK_ID>"
mcporter call sutraha-hq.sutraha_list_messages taskId="<TASK_ID>" limit=20
```

#### Start task session (when you begin real work)

```bash
mcporter call sutraha-hq.sutraha_start_task_session sessionKey="<YOUR_SESSION_KEY>" taskId="<TASK_ID>"
```

#### Update task status

```bash
mcporter call sutraha-hq.sutraha_update_task_status \
  sessionKey="<YOUR_SESSION_KEY>" \
  taskId="<TASK_ID>" \
  status="in_progress"
```

If blocked:

```bash
mcporter call sutraha-hq.sutraha_update_task_status \
  sessionKey="<YOUR_SESSION_KEY>" \
  taskId="<TASK_ID>" \
  status="blocked" \
  blockedReason="Short blocker note with owner/dependency and next expected action"
```

If complete:

```bash
mcporter call sutraha-hq.sutraha_update_task_status \
  sessionKey="<YOUR_SESSION_KEY>" \
  taskId="<TASK_ID>" \
  status="review"

mcporter call sutraha-hq.sutraha_update_task_status \
  sessionKey="<YOUR_SESSION_KEY>" \
  taskId="<TASK_ID>" \
  status="done"
```

### 6) Acknowledge (Only After Successful Processing)

If you handled everything:

```bash
mcporter call sutraha-hq.sutraha_ack_activities sessionKey="<YOUR_SESSION_KEY>"
mcporter call sutraha-hq.sutraha_ack_notifications sessionKey="<YOUR_SESSION_KEY>"
```

If you handled only some items and want the rest to stay pending:

```bash
mcporter call sutraha-hq.sutraha_ack_specific_activity \
  sessionKey="<YOUR_SESSION_KEY>" \
  activityIds='["<ACTIVITY_ID_1>","<ACTIVITY_ID_2>"]'

mcporter call sutraha-hq.sutraha_ack_specific_notification \
  sessionKey="<YOUR_SESSION_KEY>" \
  notificationIds='["<NOTIFICATION_ID_1>"]'
```

### 7) Check-Out (Required)

```bash
mcporter call sutraha-hq.sutraha_end_task_session \
  sessionKey="<YOUR_SESSION_KEY>" \
  status="idle" \
  runSummary="Heartbeat completed: processed backlog, updated tasks, and acknowledged items."
```

### 8) If Nothing To Do

Return `HEARTBEAT_OK`.

---

## What Not To Do (Common Failures)

- Do not call `sutraha_agent_pulse agentId="..."`.
  - This caused Convex validation errors like `Validator: v.id("agents")` when IDs were stale.
- Do not ack before processing.
- Do not fetch huge lists without filters if avoidable.

---

## Agent Session Keys

- Jarvis: `agent:main:main`
- Shuri: `agent:shuri:main`
- Ancient One: `agent:ancient-one:main`
- Vision: `agent:vision:main`
