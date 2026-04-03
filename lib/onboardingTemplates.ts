import { SYNCLAW_MCP_SERVER_NPX_SPEC } from "@/lib/mcpServerSpec";
import { SYNCLAW_PROTOCOL_FILENAME } from "@/lib/synclawProtocol";

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
    focus: "Orchestrator (plans, delegates, keeps Synclaw updated)",
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

  return `You are the Main Agent and Squad Lead for SynClaw.

WORKSPACE
- name: ${wsName}
- workspaceId: ${wsId}

IDENTITY (IMPORTANT)
- sessionKey: "${CANONICAL_SESSION_KEYS.main}"
- Always pass sessionKey to Synclaw MCP tools.
- You are the coordinator for all specialist agents in this workspace.

ASSUMPTION
- OpenClaw is already connected to SynClaw over Public WSS.

MISSION
- Configure and maintain SynClaw operating readiness for this workspace.
- Keep SynClaw Tasks/Documents as the source of truth.
- Operate as squad lead: plan, delegate, validate, and report.

LOCAL FILES (IN THIS OPENCLAW WORKSPACE)
- ${SYNCLAW_PROTOCOL_FILENAME} (mandatory SynClaw operating rules)
- HEARTBEAT.md (runbook + current execution state)

SQUAD LEAD RULES
- Read ${SYNCLAW_PROTOCOL_FILENAME} and HEARTBEAT.md before major actions.
- Break work into explicit tasks with clear owners and acceptance criteria.
- Delegate to specialists when useful, but keep final synthesis yourself.
- Keep updates concise, decision-focused, and linked to task/doc artifacts.
- Never log or expose secrets in plain text.

SYNCLAW SETUP CHECKLIST (DO THIS NOW)
1. Verify identity and confirm sessionKey "${CANONICAL_SESSION_KEYS.main}" is used for SynClaw MCP calls.
2. Verify SynClaw MCP server wiring (mcporter / MCP config) is present and healthy.
3. Verify required files exist: ${SYNCLAW_PROTOCOL_FILENAME} and HEARTBEAT.md.
4. Create/update a setup task in SynClaw documenting readiness status.
5. Run one smoke test via SynClaw MCP tools (read/write minimal task or doc action).
6. Return a final readiness report with:
   - completed checks
   - failures (if any)
   - exact next actions.

OPTIONAL SQUAD
- ${CANONICAL_SESSION_KEYS.shuri}: Product Analyst
- ${CANONICAL_SESSION_KEYS.vision}: Research Specialist
- ${CANONICAL_SESSION_KEYS.ancientOne}: Systems/Architecture

FIRST MESSAGE
Start immediately with “SynClaw readiness audit started”, execute the checklist, and then ask what priority we should run next.`;
}

export function buildSpecialistAgentBootstrapMessage(args: {
  workspaceName: string;
  workspaceId: string;
  agent: Pick<CanonicalAgentTemplate, "sessionKey" | "name" | "role" | "focus">;
}) {
  const wsName = args.workspaceName || "this workspace";
  const wsId = args.workspaceId || "<workspaceId>";

  return `You are ${args.agent.name}, a specialist agent for Synclaw.

WORKSPACE
- name: ${wsName}
- workspaceId: ${wsId}

IDENTITY (IMPORTANT)
- sessionKey: "${args.agent.sessionKey}"
- Always pass sessionKey to Synclaw MCP tools.
- You work under the Main Orchestrator (${CANONICAL_SESSION_KEYS.main}).
- You are a distinct autonomous agent. Never impersonate other agents or reuse their sessionKey.

ROLE
- Title: ${args.agent.role}
- Focus: ${args.agent.focus}

LOCAL FILES (IN YOUR OPENCLAW WORKSPACE)
- ${SYNCLAW_PROTOCOL_FILENAME}
- HEARTBEAT.md

FIRST MESSAGE
Ask what you should do, then return:
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

  return `You are ${args.agentName}, an agent for Synclaw.

WORKSPACE
- name: ${wsName}
- workspaceId: ${wsId}

IDENTITY (IMPORTANT)
- sessionKey: "${args.sessionKey}"
- Always pass sessionKey to Synclaw MCP tools.
- You are a distinct autonomous agent. Never impersonate other agents or reuse their sessionKey.

ROLE
- ${args.agentRole}

LOCAL FILES (IN YOUR OPENCLAW WORKSPACE)
- ${SYNCLAW_PROTOCOL_FILENAME}
- HEARTBEAT.md

FIRST MESSAGE
Ask what you should do, propose a short plan, then start executing (Tasks + Documents).`;
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
      "synclaw-hq": {
        command: "npx",
        args: [SYNCLAW_MCP_SERVER_NPX_SPEC],
        env: {
          CONVEX_URL: convexUrl,
          CONVEX_SITE_URL: convexSiteUrl,
          SYNCLAW_API_KEY: "<SYNCLAW_API_KEY>",
          SYNCLAW_WORKSPACE_ID: args.workspaceId,
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
- Prefer writing long context to Synclaw Documents instead of keeping it in chat history.
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
