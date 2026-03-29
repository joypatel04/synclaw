# Synclaw Centralized Protocol v1.1.0 (STRICT)

This is the master heartbeat instruction set for all agents. Failure to follow this leads to context collapse and hallucinations.

---

## 1. Wakeup & Triage Sequence (Parent Session)

Every 30-45 minutes, follow this sequence exactly:

### Step 1: Presence
*   Follow **Stage 1** of `SYNCLAW_HQ_PROTOCOL.md`.

### Step 2: Inbox Check
*   Fetch `synclaw_get_unseen_activities` and `synclaw_get_notifications`.
*   **DO NOT** acknowledge yet.

### Step 3: Task Pickup (CRITICAL)
*   Fetch `synclaw_get_my_tasks(includeDone=false, limit=10)`.
*   If tasks exist with status `assigned`:
    *   For EACH task: spawn a worker via `sessions_spawn` with the full task context.
    *   Worker should follow SYNCLAW_HQ_PROTOCOL.md Stage 2-4.
*   **DO NOT** acknowledge until workers are spawned.

### Step 4: Isolated Delegation (MANDATORY)
*   **NEVER** handle multiple tasks in the parent session.
*   For **EACH** unique `taskId` found in the activities:
    1.  Fetch full context: `synclaw_get_task(taskId)` and `synclaw_list_messages(taskId)`.
    2.  Prepare a **Context Package**: Title, Description, and the last 3-5 relevant comments.
    3.  Spawn a worker: `sessions_spawn`.
    4.  **Worker Prompt Template:**
        ```text
        [FOLLOW SYNCLAW_HQ_PROTOCOL.md]
        TASK_CONTEXT: [Insert Context Package here]
        NEW_ACTIVITY: [Describe the mention/update that triggered this]
        YOUR_MISSION: [Execute the specific task or reply to the mention]
        ```
    5.  Once spawned successfully, call `synclaw_ack_specific_activity` for the IDs related to that task.

---

## 2. Worker Mission Protocol (Sub-Agent Session)

If you are spawned with a `TASK_CONTEXT`, you are a **Worker**.

1.  **Compliance:** Follow all four stages of `SYNCLAW_HQ_PROTOCOL.md` (Startup -> Pickup -> Work -> Resolution).
2.  **Telemetry:** Provide accurate `totalTokensUsed` and `lastRunCost` in the `synclaw_end_task_session` call.
3.  **Memory:** Use `MEMORY_PROTOCOL.md` (Tier 1/2/3).

---

## 3. Friday Coding Workflow (STRICT - MANDATORY)

**When handling ANY coding task, follow this exact sequence:**

### Step A: Pre-Work Setup
1. **Read FRIDAY_CODE_PROTOCOL.md** - Know package manager (yarn vs bun) and Definition of Done
2. **Ensure on develop branch** - Check current branch, if NOT on develop, checkout and pull:
   ```bash
   # If on any feature/bugfix/chore branch, go back to develop first
   git checkout develop
   git pull origin develop
   ```
3. **Pull latest develop** - Ensure your base is up to date:
   ```bash
   /root/.openclaw/.secrets/git-workflow.sh setup <owner/repo>
   ```

### Step B: Branch Management
1. **Create feature branch** from develop:
   ```bash
   /root/.openclaw/.secrets/git-workflow.sh branch <type> <name>
   # Types: feature | bugfix | chore
   # Example: git-workflow.sh feature add-auth-page
   ```
2. **Apply code changes** to repo

### Step C: Definition of Done (MANDATORY)
Before marking task as done, **ALL must pass:**

| Check | vyana-web | synclaw-hq |
|--------|-----------|-------------|
| Lint | `yarn lint` | `bun run lint` |
| Type-check | `yarn tsc --noEmit` | `bun tsc --noEmit` |
| Build | `yarn build` | `bun run build` |
| Clean lock files | Only `yarn.lock` | Only `bun.lockb` |

**If any check fails → Task is NOT done. Ask @Joy for help.**

### Step D: Push & PR
1. **Commit and push changes:**
   ```bash
   /root/.openclaw/.secrets/git-workflow.sh commit "Your commit message"
   ```
2. **Open PR to develop:**
   ```bash
   /root/.openclaw/.secrets/git-workflow.sh pr <owner/repo> "PR Title"
   ```
3. **Checkout back to develop:**
   ```bash
   git checkout develop
   git pull origin develop
   ```

### Step E: Resolution
1. **Reply to task with PR link** - Include build status confirmation
2. **Only then mark task as done**
3. **Never skip lint/tsc/build** - These are non-negotiable

### Quick Reference
```bash
# Full workflow for vyana-web task:
cd /root/repos/vyana-web
/root/.openclaw/.secrets/git-workflow.sh branch feature/my-feature
# ... make changes ...
yarn lint && yarn tsc --noEmit && yarn build  # Must all pass
/root/.openclaw/.secrets/git-workflow.sh commit "Implement my feature"
/root/.openclaw/.secrets/git-workflow.sh pr joypatel04/vyana-web "Add my feature"
git checkout develop && git pull origin develop
```

---

## 4. Context Management (Anti-Bloat)

*   **No History Dumps:** Do not pass the entire conversation history to `sessions_spawn`. Only pass the **Context Package**.
*   **Surgical Reads:** Use `MEMORY_PROTOCOL.md` to fetch only what you need.
*   **Clear Handoffs:** If you mention another agent (e.g., `@Wanda`), specify exactly what you have done and what you need from them.

---

## 5. Quick Reference Table

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

_Version 1.0.0 — Context is sacred. Isolation is law._
