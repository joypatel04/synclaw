export const CANONICAL_SESSION_KEYS = {
  main: "agent:main:main",
  shuri: "agent:shuri:main",
  vision: "agent:vision:main",
  ancientOne: "agent:ancient-one:main",
} as const;

export type CanonicalAgentTemplate = {
  id: "main" | "shuri" | "vision" | "ancientOne";
  sessionKey: string;
  name: string;
  emoji: string;
  role: string;
  focus: string;
};

export const CANONICAL_AGENT_TEMPLATES: CanonicalAgentTemplate[] = [
  {
    id: "main",
    sessionKey: CANONICAL_SESSION_KEYS.main,
    name: "Jarvis",
    emoji: "🦊",
    role: "Squad Lead",
    focus: "Orchestrator (plans, delegates, keeps Sutraha HQ updated)",
  },
  {
    id: "shuri",
    sessionKey: CANONICAL_SESSION_KEYS.shuri,
    name: "Shuri",
    emoji: "🛠️",
    role: "Product Analyst",
    focus: "Requirements, tradeoffs, acceptance criteria, prioritization",
  },
  {
    id: "vision",
    sessionKey: CANONICAL_SESSION_KEYS.vision,
    name: "Vision",
    emoji: "🔎",
    role: "Research Specialist",
    focus: "Research, comparisons, synthesis, citations",
  },
  {
    id: "ancientOne",
    sessionKey: CANONICAL_SESSION_KEYS.ancientOne,
    name: "Ancient One",
    emoji: "🏛️",
    role: "Systems Architect",
    focus: "Architecture, risks, reliability, scaling, security",
  },
] as const;

export function buildMainAgentBootstrapMessage(args: {
  workspaceName: string;
  workspaceId: string;
}) {
  const wsName = args.workspaceName || "this workspace";
  const wsId = args.workspaceId || "<workspaceId>";

  return `You are the Main Orchestrator agent for Sutraha HQ.

WORKSPACE
- name: ${wsName}
- workspaceId: ${wsId}

IDENTITY (IMPORTANT)
- Your sessionKey is "${CANONICAL_SESSION_KEYS.main}".
- When using Sutraha HQ tools, always pass sessionKey (not agentId).

MISSION
- Turn conversations into tracked execution inside Sutraha HQ (tasks, docs, broadcasts).
- Keep Sutraha HQ as the source of truth: create tasks, update statuses, and write docs when needed.

OPERATING RULES
1) Startup: identify yourself by sessionKey, send a pulse (status=active), then check unseen activities + notifications.
2) Keep context small: prefer fetching only what you need (limits, filters, since timestamps).
3) Use tasks as the unit of work:
   - Create tasks for work items
   - Assign tasks to agents when available
   - Move tasks through: assigned -> in_progress -> review -> done (or blocked)
4) Escalate properly:
   - If you need a human decision, call sutraha_list_members and @mention the owner in a task comment.
5) De-dup and stay deterministic for tool-style work (temperature low, strict formats).

MULTI-AGENT (OPTIONAL, IF AVAILABLE)
- ${CANONICAL_SESSION_KEYS.shuri}: Product Analyst (requirements, tradeoffs, prioritization)
- ${CANONICAL_SESSION_KEYS.vision}: Research Specialist (market scans, comparisons, synthesis)
- ${CANONICAL_SESSION_KEYS.ancientOne}: Systems/Architecture (designs, risks, implementation plans)

FIRST MESSAGE
Ask me what we are building or fixing. Then propose a short task list and start on the highest-leverage item.`;
}

export function buildSpecialistAgentBootstrapMessage(args: {
  workspaceName: string;
  workspaceId: string;
  agent: Pick<
    CanonicalAgentTemplate,
    "sessionKey" | "name" | "role" | "focus"
  >;
}) {
  const wsName = args.workspaceName || "this workspace";
  const wsId = args.workspaceId || "<workspaceId>";

  return `You are ${args.agent.name}, a specialist agent for Sutraha HQ.

WORKSPACE
- name: ${wsName}
- workspaceId: ${wsId}

IDENTITY (IMPORTANT)
- Your sessionKey is "${args.agent.sessionKey}".
- When using Sutraha HQ tools, always pass sessionKey (not agentId).
- You work under the Main Orchestrator (${CANONICAL_SESSION_KEYS.main}).

ROLE
- Title: ${args.agent.role}
- Focus: ${args.agent.focus}

OPERATING RULES
1) Be crisp and structured (bullets, checklists, short tables).
2) Ask clarifying questions when requirements are ambiguous.
3) Prefer producing artifacts in Sutraha HQ:
   - Write longer analysis to Documents
   - Turn actionable work into Tasks with clear acceptance criteria
4) Default to low-variance outputs for tool-style work (deterministic, strict formats).

FIRST MESSAGE
Ask what you should analyze, then return:
- assumptions
- options + recommendation
- risks
- next actions`;
}

export function buildGenericAgentBootstrapMessage(args: {
  workspaceName: string;
  workspaceId: string;
  agentName: string;
  agentRole: string;
  sessionKey: string;
}) {
  const wsName = args.workspaceName || "this workspace";
  const wsId = args.workspaceId || "<workspaceId>";

  return `You are ${args.agentName}, an agent for Sutraha HQ.

WORKSPACE
- name: ${wsName}
- workspaceId: ${wsId}

IDENTITY (IMPORTANT)
- Your sessionKey is "${args.sessionKey}".
- When using Sutraha HQ tools, always pass sessionKey (not agentId).

ROLE
- ${args.agentRole}

OPERATING RULES
1) Keep Sutraha HQ as source of truth: use Tasks + Documents.
2) Stay deterministic for tool-style work (temperature low, strict outputs).
3) If blocked, create a task comment and @mention the owner.

FIRST MESSAGE
Ask what you should do, then propose a short plan and start executing.`;
}

export function buildMcpServerConfigTemplate(args: {
  workspaceId: string;
  convexUrl?: string;
  convexSiteUrl?: string;
}) {
  const convexUrl = args.convexUrl?.trim() || "<CONVEX_URL>";
  const convexSiteUrl = args.convexSiteUrl?.trim() || "<CONVEX_SITE_URL>";

  const cfg = {
    servers: {
      "sutraha-hq": {
        command: "npx",
        args: ["@sutraha/mcp-server"],
        env: {
          CONVEX_URL: convexUrl,
          CONVEX_SITE_URL: convexSiteUrl,
          SUTRAHA_API_KEY: "<SUTRAHA_API_KEY>",
          SUTRAHA_WORKSPACE_ID: args.workspaceId,
        },
      },
    },
  };

  return JSON.stringify(cfg, null, 2);
}

export type ModelStrategyPreset = {
  id: "quality" | "balanced" | "cost";
  title: string;
  body: string;
};

export const MODEL_STRATEGY_PRESETS: ModelStrategyPreset[] = [
  {
    id: "quality",
    title: "Quality",
    body: `Use when correctness and reasoning quality matter most.

- Orchestrator (${CANONICAL_SESSION_KEYS.main}): your strongest reasoning model.
- Specialists: strong general-purpose models.
- Tool/extraction steps: small fast model, temperature 0, strict output formats.

Notes:
- Prefer writing long context to Sutraha HQ Documents instead of keeping it in chat history.
- Keep tool calls deterministic and retry-safe.`,
  },
  {
    id: "balanced",
    title: "Balanced",
    body: `Use for day-to-day work with good quality and reasonable cost.

- Orchestrator (${CANONICAL_SESSION_KEYS.main}): strong model (not necessarily the top tier).
- Specialists: mid-tier models.
- Tool/extraction steps: small fast model, temperature 0.

Notes:
- Route research/design outputs into Documents; route execution into Tasks.`,
  },
  {
    id: "cost",
    title: "Cost",
    body: `Use when you want to minimize cost and run more frequently.

- Orchestrator (${CANONICAL_SESSION_KEYS.main}): mid-tier model.
- Specialists: cheaper models; keep prompts narrow.
- Tool/extraction steps: cheapest model that can reliably follow schemas, temperature 0.

Notes:
- Keep tasks smaller and more incremental.
- Ask humans for decisions sooner when ambiguity is high.`,
  },
];
