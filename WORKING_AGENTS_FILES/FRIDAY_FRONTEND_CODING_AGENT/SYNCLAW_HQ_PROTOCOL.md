# SUTRAHA HQ INTERACTION PROTOCOL (v1.0)

This protocol is MANDATORY for all agents. Failure to follow this sequence or use the correct syntax will result in task failure.

---

## 1. MANDATORY AGENT WORKFLOW

Every agent run (Worker or Parent) MUST follow these four stages:

### Stage 1: Presence (Startup)
1.  **Verify Environment:** `mcporter call synclaw-hq.synclaw_get_agent_by_session_key(sessionKey: "<your-session-key>")`
2.  **Send Pulse:** `mcporter call synclaw-hq.synclaw_agent_pulse(status: "active", sessionKey: "<your-session-key>")`

### Stage 2: Task Pickup
1.  **Link Task:** `mcporter call synclaw-hq.synclaw_start_task_session(taskId: "<taskId>", sessionKey: "<your-session-key>")`
2.  **Update Task Status:** `mcporter call synclaw-hq.synclaw_update_task_status(taskId: "<taskId>", status: "in_progress", sessionKey: "<your-session-key>")`

### Stage 3: Execution
*   Perform the work. Use **Memory Tiers** as defined in `MEMORY_PROTOCOL.md`.

### Stage 4: Resolution & Telemetry (Termination)
1.  **Post Result:** `mcporter call synclaw-hq.synclaw_send_message(content: "<detailed summary of work>", taskId: "<taskId>", sessionKey: "<your-session-key>")`
2.  **End Session:** `mcporter call synclaw-hq.synclaw_end_task_session(status: "idle", sessionKey: "<your-session-key>", telemetry: {"totalTokensUsed": <number>, "lastRunCost": <number>}, runSummary: "<short summary>")`

---

## 2. TOOL CALL SYNTAX (STRICT)

Always use **Named Arguments**. Never use positional arguments.

### Correct Examples:
```bash
# Correct: Specificity and clear naming
mcporter call synclaw-hq.synclaw_send_message \
  taskId="kx73sc..." \
  sessionKey="agent:vision:main" \
  content="SEO Audit Complete..."

# Correct: Telemetry as a JSON object
mcporter call synclaw-hq.synclaw_end_task_session \
  sessionKey="agent:main:main" \
  status="idle" \
  telemetry='{"totalTokensUsed": 4500, "lastRunCost": 0.0012}' \
  runSummary="Successfully converted docs to PDF"
```

---

## 3. TELEMETRY REQUIREMENTS

You MUST report usage at the end of every run. If your environment does not provide real-time token counts, provide your best estimate based on context window size.

*   `totalTokensUsed`: Cumulative tokens for the current run.
*   `lastRunCost`: Estimated cost in USD (e.g., 0.0015).
*   `lastRunDurationMs`: Time elapsed since startup.

---

## 4. AGENT SESSION KEYS (SUTRAHA HQ)

| Agent | Session Key |
| :--- | :--- |
| Jarvis | `agent:main:main` |
| Shuri | `agent:shuri:main` |
| Vision | `agent:vision:main` |
| Ancient One | `agent:ancient-one:main` |
| Friday | `agent:friday:main` |
| Wanda | `agent:wanda:main` |
| Nick Fury | `agent:nick-fury:main` |

---

_Version 1.0 — Compliance is not optional._
