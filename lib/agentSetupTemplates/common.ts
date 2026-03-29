import type {
  AgentSetupTemplateAgent,
  AgentSetupTemplateContext,
} from "./types";

function normalizeRole(role: string): string {
  const lower = role.toLowerCase();
  if (lower.includes("frontend") || lower.includes("code")) {
    return "frontend_coding";
  }
  return "specialist_generic";
}

export function deriveRoleModule(input: {
  role: string;
  sessionKey: string;
}): AgentSetupTemplateContext["roleModule"] {
  if (input.sessionKey === "agent:main:main") return "main_orchestrator";
  return normalizeRole(input.role) as AgentSetupTemplateContext["roleModule"];
}

export function buildIdentityMd(agent: AgentSetupTemplateAgent): string {
  return `# IDENTITY.md - Who Am I?

- **Name:** ${agent.name}
- **Role:** ${agent.role}
- **Emoji:** ${agent.emoji}
- **Session Key:** \`${agent.sessionKey}\`

---

I am a dedicated agent identity inside Synclaw HQ.
I never impersonate other agents and I always use my own session key.`;
}

export function buildUserMd(context: AgentSetupTemplateContext): string {
  const name = context.humanName?.trim() || "Workspace Owner";
  const timezone = context.humanTimezone?.trim() || "UTC";
  return `# USER.md - About Your Human

- **Name:** ${name}
- **What to call them:** ${name.split(" ")[0]}
- **Timezone:** ${timezone}

## Ground Rules

- Ask before risky infra or config changes.
- Keep communication clear, short, and actionable.
- Escalate blockers with @mentions in task comments.

## Context

- **Workspace:** ${context.workspaceName}
- **workspaceId:** \`${context.workspaceId}\`
- This file is the durable source of human preferences and collaboration style.`;
}

export function buildToolsMd(): string {
  return `# TOOLS.md - Shared Tooling Rules

## Core Rule

Use Synclaw MCP tools via named arguments and explicit sessionKey.

## Shared Tools

- \`mcporter\`: access Synclaw HQ MCP functions.
- \`lightpanda-scrape\`: dynamic pages / SPA scraping.
- \`web_fetch\`: static pages and docs.

## Web Scraping Policy

- Do not rely on OpenClaw GUI browser tooling in headless/server flows.
- Prefer \`lightpanda-scrape\` for dynamic websites.
- Prefer \`web_fetch\` for static documentation pages.

## Task Execution Rules

- Start with \`synclaw_start_task_session\` when taking task work.
- End with \`synclaw_end_task_session\` and telemetry fields.
- Always post a task comment before ending a run if work happened.

## Seen-state Rules

- Process unseen activity/notifications first.
- Acknowledge only after handling work.
- Prefer specific ack calls over bulk ack behavior.`;
}

export function buildAgentsMd(input: {
  workspaceName: string;
  workspaceId: string;
  agents: AgentSetupTemplateAgent[];
}): string {
  const rows = input.agents
    .slice()
    .sort((a, b) => a.sessionKey.localeCompare(b.sessionKey))
    .map((agent) => {
      const folder = agent.workspaceFolderPath || "<fill>";
      return `| ${agent.emoji} ${agent.name} | \`${agent.sessionKey}\` | ${
        agent.role
      } | \`${agent.id ?? "<create in Synclaw>"}\` | \`${folder}\` |`;
    })
    .join("\n");
  return `# AGENTS.md — Synclaw Agent Orchestration

**Workspace:** ${input.workspaceName}  
**workspaceId:** \`${input.workspaceId}\`

## Agent Identity

| Agent | Session Key | Role | Workspace Path |
|-------|-------------|------|--------------------------|
${rows || "| (none) |  |  |  |"}

## Coordination Rules

- Every agent uses its own session key.
- Never impersonate another agent.
- Keep this file synced when adding/removing agents.
- Agent workspace mapping must match real OpenClaw folders.`;
}

export function buildSynclawHqProtocolMd(input: {
  sessionKey: string;
  workspaceId: string;
  workspaceName: string;
}): string {
  return `# SYNCLAW_HQ_PROTOCOL.md (STRICT)

This file is mandatory. It defines execution order for Synclaw backend integration.

## Identity

- sessionKey: \`${input.sessionKey}\`
- workspaceId: \`${input.workspaceId}\`
- workspace: ${input.workspaceName}

## Stage 1: Presence

1. Call \`synclaw_agent_pulse(sessionKey="${input.sessionKey}", status="active")\`

## Stage 2: Triage

1. Call \`synclaw_get_unseen_activities(sessionKey="${input.sessionKey}")\`
2. Call \`synclaw_get_notifications(sessionKey="${input.sessionKey}")\`
3. Call \`synclaw_get_my_tasks(sessionKey="${input.sessionKey}", includeDone=false, limit=10)\`

## Stage 3: Task execution

1. Pick highest-priority actionable task.
2. Start task session.
3. Execute, update statuses, and write short progress comments.
4. Put long outputs in Documents.

## Stage 4: Resolution

1. Send final task comment.
2. Ack seen items after processing.
3. End task session with telemetry (tokens, duration, cost).

## Non-negotiable

- Do not use another agent session key.
- Do not skip end-task telemetry.
- Do not mark work done without task comment evidence.`;
}
