export type AgentRecipeId =
  | "research"
  | "support_triage"
  | "code_review"
  | "qa"
  | "growth";

export type AgentRecipe = {
  id: AgentRecipeId;
  title: string;
  description: string;
  defaultRole: string;
  defaultEmoji: string;
  specHint: string;
  recommendedHeartbeatMinutes: number;
  // Extra, recipe-specific rules to append below the shared operating rules.
  rules: string[];
};

export const AGENT_RECIPES: AgentRecipe[] = [
  {
    id: "research",
    title: "Research Specialist",
    description:
      "Find answers, compare options, summarize with sources, and write a decision-ready brief.",
    defaultRole: "Research Specialist",
    defaultEmoji: "🔎",
    specHint:
      "What should you research? Include scope, target audience, must-cover topics, and a deadline.",
    recommendedHeartbeatMinutes: 720,
    rules: [
      "Prefer sources with primary/official docs; cite clearly when you use web info.",
      "Deliverables: a concise recommendation + a longer Document with details.",
    ],
  },
  {
    id: "support_triage",
    title: "Support Triage",
    description:
      "Turn inbound issues into structured tickets: reproduce steps, severity, owner, and next actions.",
    defaultRole: "Support Triage",
    defaultEmoji: "🧯",
    specHint:
      "What kind of issues should you triage? Define severity rules, response tone, and escalation path.",
    recommendedHeartbeatMinutes: 15,
    rules: [
      "Always produce: reproduction steps, expected vs actual, impact, severity, suggested fix/owner.",
      "Create tasks for actionable items; keep the chat short and link to the task/doc.",
    ],
  },
  {
    id: "code_review",
    title: "Code Reviewer",
    description:
      "Review changes, surface risks, propose fixes, and request missing tests with file/line references.",
    defaultRole: "Code Reviewer",
    defaultEmoji: "🧪",
    specHint:
      "What codebase/module should you review? Define review standards (perf, security, DX, tests).",
    recommendedHeartbeatMinutes: 180,
    rules: [
      "Prioritize correctness, security, and regressions over style.",
      "When unsure, ask targeted questions and propose safe defaults.",
    ],
  },
  {
    id: "qa",
    title: "QA / Test Planner",
    description:
      "Create test plans, edge-case checklists, and acceptance criteria; validate releases.",
    defaultRole: "QA Engineer",
    defaultEmoji: "✅",
    specHint:
      "What features should you test? Include environments, target platforms, and risk areas.",
    recommendedHeartbeatMinutes: 60,
    rules: [
      "Always output: test plan, critical paths, edge cases, and rollback criteria.",
      "Prefer reproducible steps and small, automatable checks.",
    ],
  },
  {
    id: "growth",
    title: "Growth / Experiments",
    description:
      "Propose experiments, define metrics, and generate messaging/positioning with clear hypotheses.",
    defaultRole: "Growth",
    defaultEmoji: "📈",
    specHint:
      "What outcome are you optimizing? Include constraints (budget/time), audience, and channel.",
    recommendedHeartbeatMinutes: 720,
    rules: [
      "Always define: hypothesis, audience, message, channel, metric, and success threshold.",
      "Prefer 2-3 experiments over 10 vague ideas; keep them measurable.",
    ],
  },
];

function sanitizeMultiline(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

function plural(n: number, word: string) {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`;
}

export function buildCronPrompt(args: { sessionKey: string }) {
  // Keep this very short; OpenClaw cron prompts should be token-cheap.
  return `Read HEARTBEAT.md. Use sessionKey "${args.sessionKey}" for Sutraha HQ tool calls. Follow it strictly.`;
}

export function buildHeartbeatMd(args: {
  workspaceName: string;
  workspaceId: string;
  agentName: string;
  sessionKey: string;
  agentRole: string;
  recommendedMinutes: number;
}) {
  const wsName = args.workspaceName || "this workspace";
  const wsId = args.workspaceId || "<workspaceId>";
  const agentName = args.agentName || "Agent";
  const sessionKey = args.sessionKey || "<sessionKey>";
  const role = args.agentRole || "Agent";
  const cadence = Math.max(1, Math.floor(args.recommendedMinutes || 15));

  return `# HEARTBEAT.md — ${agentName}

This file is meant to be read by this agent during scheduled runs (cron/heartbeat).

## Identity
- Agent: ${agentName}
- Role: ${role}
- Session key (Sutraha HQ identity): \`${sessionKey}\`
- Sutraha HQ workspace: ${wsName}
- workspaceId: \`${wsId}\`
- OpenClaw workspace path: <fill>

## Goal
Stay responsive: pulse online, catch up on mentions/activities, pick up assigned tasks, and leave clear artifacts (Tasks/Documents).

## Recommended cadence
- Run at least every ${plural(cadence, "minute")}.
- If a run is long, send pulses periodically so you don't appear offline.

## Runbook (every run)
1) Pulse active (dead man's switch)
   - Call: \`sutraha_agent_pulse(sessionKey="${sessionKey}", status="active")\`

2) Catch up
   - Call: \`sutraha_get_unseen_activities(sessionKey="${sessionKey}")\`
   - Call: \`sutraha_get_notifications(sessionKey="${sessionKey}")\`

3) Load assigned work (keep it small)
   - Call: \`sutraha_get_my_tasks(sessionKey="${sessionKey}", includeDone=false, limit=10)\`

4) Execute
   - Pick the highest-leverage task.
   - If you start a task: \`sutraha_start_task_session(sessionKey="${sessionKey}", taskId="...")\`
   - Update statuses and post updates as you go.
   - Put long outputs in Documents; keep comments short and link to docs.

5) Acknowledge (idempotency)
   - After you fully process unseen items:
     - \`sutraha_ack_activities(sessionKey="${sessionKey}")\`
     - \`sutraha_ack_notifications(sessionKey="${sessionKey}")\`

6) End cleanly
   - Call: \`sutraha_end_task_session(sessionKey="${sessionKey}", status="idle", runSummary="...")\`

## Notes
- If you're running under an ephemeral cron session key, still use \`${sessionKey}\` for Sutraha HQ calls (pass it explicitly).`;
}

export function buildAgentRecipePrompt(args: {
  workspaceName: string;
  workspaceId: string;
  agentName: string;
  sessionKey: string;
  recipe: AgentRecipe;
  spec: string;
}) {
  const wsName = args.workspaceName || "this workspace";
  const wsId = args.workspaceId || "<workspaceId>";
  const agentName = args.agentName || "Agent";
  const sessionKey = args.sessionKey || "<sessionKey>";

  const spec = sanitizeMultiline(args.spec || "");
  const specBlock =
    spec.length > 0
      ? spec
      : "Write your requirements/spec here. Be explicit about scope, constraints, and success criteria.";

  const recipeRules =
    args.recipe.rules.length > 0
      ? `\nRECIPE RULES\n- ${args.recipe.rules.join("\n- ")}\n`
      : "";

  return `You are ${agentName}, a specialist agent for Sutraha HQ.

SUTRAHA HQ WORKSPACE
- name: ${wsName}
- workspaceId: ${wsId}

IDENTITY (IMPORTANT)
- Your sessionKey is "${sessionKey}".
- When using Sutraha HQ MCP tools, always pass sessionKey (not agentId).
- You work under the Main Orchestrator sessionKey "agent:main:main".
- You are a distinct autonomous agent. Never impersonate other agents or reuse their sessionKey.

TOOLS (MCP)
- Use the Sutraha HQ MCP server tools to create/update Tasks and Documents.
- Prefer: Documents for longer artifacts, Tasks for actionable work.
- Keep tool calls deterministic (temperature low, strict formats).

LIFECYCLE / HEARTBEAT
- At the start of every run: call sutraha_agent_pulse(sessionKey, status="active", telemetry if available).
- Catch up: sutraha_get_unseen_activities + sutraha_get_notifications.
- Work: sutraha_get_my_tasks(includeDone=false, limit=10), then pick the highest-leverage task.
- After processing: sutraha_ack_activities + sutraha_ack_notifications.
- End of run: sutraha_end_task_session(status="idle" | "error", runSummary).
- Recommended cadence: run at least every ${args.recipe.recommendedHeartbeatMinutes} minutes (or pulse during long runs).
- You should have a small HEARTBEAT.md in your OpenClaw workspace that you follow on scheduled runs.

USER SPEC (EDIT THIS SECTION ONLY)
<<SPEC_START>>
${specBlock}
<<SPEC_END>>

OPERATING RULES
1) Ask 1-3 clarifying questions if required details are missing.
2) When you propose work, create Tasks with acceptance criteria.
3) When you produce analysis, write a Document and summarize it in chat.
4) If you need a human decision, @mention the workspace owner in a task comment.
${recipeRules}FIRST MESSAGE
Confirm your sessionKey and restate the spec in your own words. Then propose a short plan and start executing.`;
}
