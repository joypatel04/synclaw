export type AutopilotBusinessStage =
  | "idea"
  | "pre_launch"
  | "onboarding"
  | "early_revenue"
  | "growth";

export type AutopilotRiskTolerance = "low" | "medium" | "high";
export type ModeOfWork =
  | "building"
  | "operations_execution"
  | "closing"
  | "strategic_planning"
  | "technical_debt";

export type TaskCategory =
  | "outreach"
  | "interviews"
  | "ab_test"
  | "funnel_redesign"
  | "ops_sop"
  | "ops_bottleneck"
  | "ops_tracking"
  | "readiness_definition"
  | "instrumentation";

export type AutopilotProfileInput = {
  businessStage: AutopilotBusinessStage;
  modeOfWork: ModeOfWork;
  northStarMetric: string;
  weeklyGoal: string;
  constraints: string[];
  negativeConstraints: string[];
  channels: string[];
  targetAudience: string;
  timeBudgetHoursPerWeek: number;
  riskTolerance: AutopilotRiskTolerance;
};

export type PlanningTaskCandidate = {
  title: string;
  description: string;
  priority: "high" | "medium" | "low" | "none";
  status: "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked";
  assigneeSessionKey: string;
  dueAt: number | null;
  whyNow: string;
  dedupeKey: string;
  confidence: number;
  kpiImpactScore: number;
  actionType: string;
  category: TaskCategory;
};

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeTitle(input: string): string {
  return clean(input).toLowerCase();
}

export async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildDedupeKey(args: {
  title: string;
  primaryKpi: string;
  targetSegment: string;
  actionType: string;
}): Promise<string> {
  const canonical = [
    normalizeTitle(args.title),
    clean(args.primaryKpi).toLowerCase(),
    clean(args.targetSegment).toLowerCase(),
    clean(args.actionType).toLowerCase(),
  ].join("|");
  return await sha256Hex(canonical);
}

function priorityScore(priority: PlanningTaskCandidate["priority"]): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  if (priority === "low") return 1;
  return 0;
}

export function rankCandidates(candidates: PlanningTaskCandidate[]): PlanningTaskCandidate[] {
  return [...candidates].sort((a, b) => {
    const scoreA = priorityScore(a.priority) + a.confidence * 2 + a.kpiImpactScore;
    const scoreB = priorityScore(b.priority) + b.confidence * 2 + b.kpiImpactScore;
    return scoreB - scoreA;
  });
}

export function firstNonEmpty(values: Array<string | undefined | null>, fallback: string): string {
  for (const value of values) {
    const cleanValue = value?.trim();
    if (cleanValue) return cleanValue;
  }
  return fallback;
}

const BLOCK_MAP: Array<{ pattern: RegExp; categories: TaskCategory[] }> = [
  { pattern: /outreach|reach|campaign|lead[- ]?gen|whatsapp|cold/i, categories: ["outreach"] },
  { pattern: /interview|user talk|discovery/i, categories: ["interviews"] },
  { pattern: /a\/b|ab test|split test|experiment/i, categories: ["ab_test"] },
  { pattern: /funnel|redesign|flow redesign|ux overhaul|onboarding redesign/i, categories: ["funnel_redesign"] },
];

export function mapNegativeConstraintsToBlockedCategories(
  constraints: string[],
): TaskCategory[] {
  const out = new Set<TaskCategory>();
  for (const row of constraints) {
    const value = row.trim();
    if (!value) continue;
    for (const entry of BLOCK_MAP) {
      if (entry.pattern.test(value)) {
        for (const category of entry.categories) out.add(category);
      }
    }
  }
  return Array.from(out);
}

export function isCategoryBlocked(
  category: TaskCategory,
  blocked: TaskCategory[],
): boolean {
  return blocked.includes(category);
}

const RELEVANCE_BY_MODE: Record<ModeOfWork, Record<TaskCategory, number>> = {
  building: {
    outreach: 1,
    interviews: 2,
    ab_test: 2,
    funnel_redesign: 3,
    ops_sop: 1,
    ops_bottleneck: 1,
    ops_tracking: 2,
    readiness_definition: 1,
    instrumentation: 2,
  },
  operations_execution: {
    outreach: 0,
    interviews: 0,
    ab_test: 0,
    funnel_redesign: 0,
    ops_sop: 3,
    ops_bottleneck: 3,
    ops_tracking: 3,
    readiness_definition: 3,
    instrumentation: 2,
  },
  closing: {
    outreach: 1,
    interviews: 0,
    ab_test: 0,
    funnel_redesign: 0,
    ops_sop: 3,
    ops_bottleneck: 3,
    ops_tracking: 2,
    readiness_definition: 3,
    instrumentation: 2,
  },
  strategic_planning: {
    outreach: 1,
    interviews: 2,
    ab_test: 1,
    funnel_redesign: 2,
    ops_sop: 1,
    ops_bottleneck: 1,
    ops_tracking: 2,
    readiness_definition: 2,
    instrumentation: 2,
  },
  technical_debt: {
    outreach: 0,
    interviews: 0,
    ab_test: 0,
    funnel_redesign: 0,
    ops_sop: 1,
    ops_bottleneck: 2,
    ops_tracking: 2,
    readiness_definition: 1,
    instrumentation: 3,
  },
};

export function computeRelevanceScore(
  modeOfWork: ModeOfWork,
  candidateCategory: TaskCategory,
  context: { staleTaskCount?: number; openTaskCount?: number },
): number {
  const base = RELEVANCE_BY_MODE[modeOfWork]?.[candidateCategory] ?? 0;
  const staleBoost =
    candidateCategory === "ops_bottleneck" && (context.staleTaskCount ?? 0) > 5
      ? 1
      : 0;
  const throughputBoost =
    candidateCategory === "ops_tracking" && (context.openTaskCount ?? 0) > 10
      ? 1
      : 0;
  return base + staleBoost + throughputBoost;
}

export function buildStrategyDocumentContent(args: {
  objective: string;
  kpiTarget: string;
  profile: AutopilotProfileInput;
  assumptions: string[];
  risks: string[];
  blockedBy: string[];
  selected: PlanningTaskCandidate[];
  skipped: Array<{ title: string; reason: string }>;
  blockedCategories?: TaskCategory[];
  deferredSuggestions?: Array<{ title: string; reason: string; category: TaskCategory }>;
  qualityFlags?: string[];
}): string {
  const lines: string[] = [];
  lines.push("# Weekly Autopilot Plan");
  lines.push("");
  lines.push("## Objective");
  lines.push(args.objective);
  lines.push("");
  lines.push("## KPI Target");
  lines.push(args.kpiTarget);
  lines.push("");
  lines.push("## Founder Brief Snapshot");
  lines.push(`- Stage: ${args.profile.businessStage}`);
  lines.push(`- Mode of work: ${args.profile.modeOfWork}`);
  lines.push(`- Weekly goal: ${args.profile.weeklyGoal}`);
  lines.push(`- North star metric: ${args.profile.northStarMetric}`);
  lines.push(`- Target audience: ${args.profile.targetAudience}`);
  lines.push(`- Channels: ${args.profile.channels.join(", ") || "n/a"}`);
  lines.push(`- Constraints: ${args.profile.constraints.join(" | ") || "n/a"}`);
  lines.push(
    `- Negative constraints: ${args.profile.negativeConstraints.join(" | ") || "n/a"}`,
  );
  lines.push(`- Time budget (hours/week): ${args.profile.timeBudgetHoursPerWeek}`);
  lines.push(`- Risk tolerance: ${args.profile.riskTolerance}`);
  lines.push("");
  lines.push("## Prioritized Tasks");
  args.selected.forEach((task, index) => {
    lines.push(`${index + 1}. ${task.title}`);
    lines.push(`   - Priority: ${task.priority}`);
    lines.push(`   - Confidence: ${task.confidence.toFixed(2)}`);
    lines.push(`   - Why now: ${task.whyNow}`);
  });
  lines.push("");
  lines.push("## Skipped Duplicates");
  if (args.skipped.length === 0) {
    lines.push("- None");
  } else {
    args.skipped.forEach((item) => {
      lines.push(`- ${item.title}: ${item.reason}`);
    });
  }
  lines.push("");
  lines.push("## Blocked Categories (hard exclusion)");
  const blockedCategories = args.blockedCategories ?? [];
  if (blockedCategories.length === 0) {
    lines.push("- None");
  } else {
    blockedCategories.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("");
  lines.push("## Deferred Opportunities (not created)");
  const deferredSuggestions = args.deferredSuggestions ?? [];
  if (deferredSuggestions.length === 0) {
    lines.push("- None");
  } else {
    deferredSuggestions.forEach((item) => {
      lines.push(`- ${item.title} [${item.category}]: ${item.reason}`);
    });
  }
  lines.push("");
  lines.push("## Assumptions");
  args.assumptions.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("## Risks");
  args.risks.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("## Blockers");
  args.blockedBy.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("## Quality Flags");
  const qualityFlags = args.qualityFlags ?? [];
  if (qualityFlags.length === 0) {
    lines.push("- None");
  } else {
    qualityFlags.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("");
  lines.push("---");
  lines.push("Generated by Autopilot v1.1 (Mode-aware planning)");
  return lines.join("\n");
}
