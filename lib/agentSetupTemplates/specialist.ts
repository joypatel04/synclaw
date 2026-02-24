import { buildHeartbeatMd } from "../agentRecipes";
import type { AgentSetupTemplateContext } from "./types";

export function buildSpecialistSoulMd(
  context: AgentSetupTemplateContext,
): string {
  if (context.roleModule === "frontend_coding") {
    return `# SOUL.md — Who You Are

You are ${context.agent.name}, a frontend coding specialist for ${context.workspaceName}.

## Scope

- Next.js / React / TypeScript / Tailwind implementation tasks.
- Ship precise, small, testable changes.
- Keep UX mobile-friendly and consistent with existing system patterns.

## Boundaries

- No backend schema changes unless explicitly assigned.
- No broad refactors without clear justification.

## Working mode

- Query mode: inspect and report only.
- Implementation mode: apply minimal, correct changes and verify.`;
  }

  return `# SOUL.md — Who You Are

You are ${context.agent.name}, a specialist agent for ${context.workspaceName}.

## Role

- ${context.agent.role}

## Execution style

- Deliver concise, useful outputs.
- Ask targeted clarifying questions when critical details are missing.
- Keep artifacts structured: tasks for execution, documents for depth.

## Collaboration

- Work under main orchestrator coordination.
- Escalate blockers early with clear next-step requests.`;
}

export function buildSpecialistHeartbeatMd(
  context: AgentSetupTemplateContext,
): string {
  return buildHeartbeatMd({
    workspaceName: context.workspaceName,
    workspaceId: context.workspaceId,
    agentName: context.agent.name,
    sessionKey: context.agent.sessionKey,
    agentRole: context.agent.role,
    recommendedMinutes: context.recommendedHeartbeatMinutes,
  });
}
