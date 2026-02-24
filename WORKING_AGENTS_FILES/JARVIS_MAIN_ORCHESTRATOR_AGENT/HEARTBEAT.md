# Sutraha HQ Centralized Protocol v1.2.0 (STRICT)

This is the master heartbeat instruction set for all agents. Failure to follow this sequence leads to state desync and task loss.

---

## 1. Wakeup & Triage Sequence (Parent Session)

Every 30-45 minutes, follow this sequence exactly:

### Step 1: Presence
*   Follow **Stage 1** of `SUTRAHA_HQ_PROTOCOL.md`.

### Step 2: Inbox Check (FETCH ONLY)
*   Fetch `sutraha_get_unseen_activities` and `sutraha_get_notifications`.
*   **NEW:** Fetch `sutraha_get_my_tasks(includeDone=false, limit=10)`.
*   **DO NOT** acknowledge yet.

### Step 3: Task Pickup (CRITICAL)
*   For **EACH** task in `assigned` status: spawn a worker via `sessions_spawn`.
*   **NEVER** handle multiple tasks in the parent session.
*   **FORBIDDEN:** Never use `sutraha_ack_activities` or `sutraha_ack_notifications` (Bulk Ack).
*   For **EACH** unique `taskId` found in the activities:
    1.  Fetch full context: `sutraha_get_task(taskId)` and `sutraha_list_messages(taskId)`.
    2.  Spawn a worker: `sessions_spawn`.
    3.  **Worker Prompt Template:**
        ```text
        [FOLLOW SUTRAHA_HQ_PROTOCOL.md Stage 3-5]
        TASK_ID: [taskId]
        CONTEXT: [Insert Context Package]
        MISSION: [Specific action needed]
        ```
    4.  Once spawned successfully, call `sutraha_ack_specific_activity` or `sutraha_ack_specific_notification` for the IDs related to that task.

---

## 2. Worker Mission Protocol (Sub-Agent Session)

1.  **Compliance:** Follow Stages 3-5 of `SUTRAHA_HQ_PROTOCOL.md`.
2.  **Telemetry:** Provide accurate `totalTokensUsed` and `lastRunCost` in `sutraha_end_task_session`.
3.  **Specific Output:** Every run MUST end with a comment to the task so the status is recorded.

---

## 4. Quick Reference Table

| Agent | Session Key | Role | Agent ID |
| :--- | :--- | :--- | :--- |
| Jarvis | `agent:main:main` | Squad Lead | `j973g1r1rr1e5ntvd4tegq9k4x80s560` |
| Shuri | `agent:shuri:main` | Product Analyst | `j972sahxmcn8ptk241qjqrm9jd80rata` |
| Vision | `agent:vision:main` | SEO & Discovery | `j97c3rf071xqqp0p74jj1rtxcx8100tz` |
| Ancient One | `agent:ancient-one:main` | Research Specialist | `j977fwnfr4fdjq8m9v2v6ayk1180rjbc` |
| Friday | `agent:friday:main` | Frontend Code Assistant | `j977qkm5wpchy9y9nwrny5bb1h81cv1b` |
| Wanda | `agent:wanda:main` | Content Writer | `j975atr2qhw57rjtr8qqpff6xd81mjax` |
| Nick Fury | `agent:nick-fury:main` | Operations Manager | `j9760p2syas9sq0qb0qcrdaz7181nb76` |

---

_Version 1.2.0 — Compliance is the only path._
