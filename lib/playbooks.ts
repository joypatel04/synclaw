import type { AgentRecipeId } from "@/lib/agentRecipes";

export type PlaybookId =
  | "research"
  | "support_triage"
  | "code_review"
  | "qa"
  | "growth"
  | "delivery";

export type Playbook = {
  id: PlaybookId;
  title: string;
  description: string;
  recipeId?: AgentRecipeId;
  recommendedHeartbeatMinutes?: number;
  goodLooksLike: string[];
  stepByStep: string[];
  starterTaskTemplate: string;
  starterDocTemplate: string;
};

export const PLAYBOOKS: Playbook[] = [
  {
    id: "research",
    title: "Research a decision",
    description: "Get a cited brief + a clear recommendation.",
    recipeId: "research",
    recommendedHeartbeatMinutes: 720,
    goodLooksLike: [
      "You get a short recommendation fast, then a longer cited brief in Documents.",
      "Follow-ups are Tasks with owners and acceptance criteria.",
      "The agent asks 1-3 clarifying questions instead of guessing scope.",
    ],
    stepByStep: [
      "Create a Research Specialist agent from the recipe.",
      "Run the setup wizard: add HEARTBEAT.md + cron.",
      "Send the SPEC prompt for the decision you want researched.",
      "Ask for a 1-page brief first, then a deep dive if needed.",
      "Track follow-ups as Tasks and link them to the decision doc.",
    ],
    starterTaskTemplate: `# Research Follow-ups (Task checklist)

- [ ] Confirm decision scope + constraints
- [ ] List 3-5 options (with sources)
- [ ] Compare tradeoffs (cost, time, risk)
- [ ] Recommend 1 option with rationale
- [ ] Create implementation Tasks (owners + acceptance criteria)`,
    starterDocTemplate: `# Decision Brief (Document template)

## Executive summary
- Recommendation:
- Why:
- Biggest risks:

## Options considered
1) Option A
2) Option B
3) Option C

## Comparison
- Cost:
- Time:
- Complexity:
- Risks:

## Recommendation details

## Sources
- (links)`,
  },
  {
    id: "support_triage",
    title: "Support triage",
    description: "Turn inbound issues into reproducible, owned Tasks.",
    recipeId: "support_triage",
    recommendedHeartbeatMinutes: 15,
    goodLooksLike: [
      "Every issue results in a Task with reproduction steps + severity.",
      "The agent consistently asks for URL, timestamp, browser, and console errors.",
      "Escalations are clean @mentions in task comments.",
    ],
    stepByStep: [
      "Create a Support Triage agent from the recipe.",
      "Run the setup wizard and schedule frequent heartbeats (15m).",
      "Send a SPEC describing your severity rules + escalation path.",
      "Have the agent convert every inbound issue into a Task.",
      "Use Documents only when the report is long (logs, analysis, root cause).",
    ],
    starterTaskTemplate: `# Support Ticket (Task template)

## Summary

## Severity
- P0 / P1 / P2

## Environment
- URL:
- Timestamp:
- Browser + version:
- User/workspace:

## Reproduction steps
1)
2)
3)

## Expected vs actual
- Expected:
- Actual:

## Suspected cause

## Next action + owner`,
    starterDocTemplate: `# Bug Report (Document template)

## Context

## Evidence
- Screenshots:
- Console logs:
- Network traces:

## Hypotheses
1)
2)

## Fix options
- Quick fix:
- Proper fix:

## Rollout / verification`,
  },
  {
    id: "code_review",
    title: "Code review",
    description: "Catch regressions, missing tests, and risky changes early.",
    recipeId: "code_review",
    recommendedHeartbeatMinutes: 180,
    goodLooksLike: [
      "Findings are ordered by severity and include file/line references.",
      "Security and correctness issues are prioritized over style.",
      "Missing tests are explicitly requested with concrete suggestions.",
    ],
    stepByStep: [
      "Create a Code Reviewer agent from the recipe.",
      "Run setup wizard; cadence can be slower (on-demand is fine).",
      "Send a SPEC for your review bar (security/perf/DX/tests).",
      "Paste diffs or link PR context; ask for a final review summary.",
      "Track major follow-ups as Tasks.",
    ],
    starterTaskTemplate: `# Code Review Follow-ups (Task checklist)

- [ ] Confirm behavior changes are intentional
- [ ] Identify regression risks + mitigation
- [ ] Verify error handling paths
- [ ] Add/adjust tests (unit/integration/e2e)
- [ ] Confirm performance impact`,
    starterDocTemplate: `# Code Review Notes (Document template)

## Summary

## Findings (ordered by severity)
1) [P0] ...
2) [P1] ...

## Questions

## Suggested fixes

## Test gaps`,
  },
  {
    id: "qa",
    title: "Release QA",
    description: "Build a test plan, edge cases, and acceptance checklists.",
    recipeId: "qa",
    recommendedHeartbeatMinutes: 60,
    goodLooksLike: [
      "Critical paths and edge cases are explicit and reproducible.",
      "Acceptance criteria are checklists, not paragraphs.",
      "Rollout/rollback criteria are written before shipping.",
    ],
    stepByStep: [
      "Create a QA / Test Planner agent from the recipe.",
      "Run setup wizard; cadence depends on release cycle.",
      "Send a SPEC describing the feature + environments + platforms.",
      "Have the agent produce a test plan + acceptance checklist.",
      "Track execution as Tasks (assign to agents/humans as needed).",
    ],
    starterTaskTemplate: `# QA Checklist (Task template)

- [ ] Happy path
- [ ] Permissions/roles
- [ ] Error states
- [ ] Performance (slow network / large data)
- [ ] Accessibility (keyboard, contrast)
- [ ] Mobile layout
- [ ] Rollback plan verified`,
    starterDocTemplate: `# Test Plan (Document template)

## Scope

## Environments
- Dev:
- Staging:
- Prod:

## Critical paths
1)
2)

## Edge cases

## Acceptance criteria checklist

## Rollout / rollback`,
  },
  {
    id: "growth",
    title: "Growth experiments",
    description: "Define hypotheses, metrics, and measurable tests.",
    recipeId: "growth",
    recommendedHeartbeatMinutes: 720,
    goodLooksLike: [
      "Experiments have a single primary metric and a clear threshold.",
      "You run 2-3 focused tests, not 10 vague ideas.",
      "Artifacts live in Documents, actions in Tasks.",
    ],
    stepByStep: [
      "Create a Growth agent from the recipe.",
      "Run setup wizard; cadence can be daily/weekly.",
      "Send a SPEC describing the outcome + audience + constraints.",
      "Have the agent propose 2-3 experiments with metrics.",
      "Track execution as Tasks and write results to a Document.",
    ],
    starterTaskTemplate: `# Experiment Execution (Task checklist)

- [ ] Define hypothesis
- [ ] Define audience/segment
- [ ] Define primary metric + threshold
- [ ] Implement variant(s)
- [ ] Run for a fixed time window
- [ ] Analyze results
- [ ] Decide: ship / iterate / kill`,
    starterDocTemplate: `# Experiment Plan (Document template)

## Hypothesis

## Audience

## Variants

## Metrics
- Primary:
- Guardrails:

## Run plan
- Duration:
- Traffic split:

## Results

## Decision`,
  },
  {
    id: "delivery",
    title: "Ship a feature (multi-agent)",
    description: "Orchestrate from spec to shipped with a main agent + specialists.",
    goodLooksLike: [
      "Main agent owns the plan and keeps Tasks up to date.",
      "Specialists produce Documents (briefs, designs, test plans).",
      "Status is broadcast periodically, not lost in chat.",
    ],
    stepByStep: [
      "Make sure your main agent exists (agent:main:main) and is connected.",
      "Create specialists (product, research, systems) as needed.",
      "Use setup wizard for each agent: HEARTBEAT.md + cron + protocol.",
      "Main agent breaks work into Tasks and assigns to specialists.",
      "Specialists write Documents; main agent links them and tracks progress.",
    ],
    starterTaskTemplate: `# Feature Delivery (Task checklist)

- [ ] Clarify requirements and acceptance criteria
- [ ] Write architecture/design doc
- [ ] Plan milestones + owners
- [ ] Implement (small tasks)
- [ ] QA plan + verification
- [ ] Rollout plan + monitoring
- [ ] Post-ship notes`,
    starterDocTemplate: `# Feature Spec (Document template)

## Problem

## Goals / non-goals

## Requirements

## Acceptance criteria

## Implementation notes

## Rollout / monitoring`,
  },
];

export function getPlaybook(id: string | null | undefined): Playbook | null {
  if (!id) return null;
  return PLAYBOOKS.find((p) => p.id === id) ?? null;
}

