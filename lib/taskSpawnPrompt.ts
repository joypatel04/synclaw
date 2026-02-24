import type { Doc } from "@/convex/_generated/dataModel";

type PromptAgent = Pick<Doc<"agents">, "name" | "sessionKey" | "emoji">;
type PromptTask = Pick<
  Doc<"tasks">,
  "_id" | "title" | "status" | "priority" | "description"
> & {
  blockedReason?: string;
};

export function buildTaskSpawnPrompt(args: {
  task: PromptTask;
  selectedAgent: PromptAgent;
  taskAssignees: string[];
  commentContent: string;
  actorDisplayName: string;
  canonicalSessionKey: string;
  runSessionKey: string;
}) {
  const assignees =
    args.taskAssignees.length > 0 ? args.taskAssignees.join(", ") : "(none)";
  const blockedReason =
    args.task.status === "blocked" && args.task.blockedReason
      ? args.task.blockedReason
      : "(none)";
  const description = args.task.description?.trim() || "(empty)";
  const comment = args.commentContent.trim();

  return [
    "# INTENT",
    "Immediate execution request from Synclaw task comment.",
    "",
    "# TASK CONTEXT",
    `- taskId: ${args.task._id}`,
    `- title: ${args.task.title}`,
    `- status: ${args.task.status}`,
    `- priority: ${args.task.priority}`,
    `- assignees: ${assignees}`,
    blockedReason ? `- blockedReason: ${blockedReason}` : null,
    "",
    "# TASK DESCRIPTION",
    description,
    "",
    "# NEW COMMENT",
    `From: ${args.actorDisplayName}`,
    comment,
    "",
    "# SESSION RULES",
    `- You are being spawned in isolated run session: ${args.runSessionKey}`,
    `- Your canonical identity is: ${args.canonicalSessionKey}`,
    "- For Synclaw MCP calls, always pass canonical sessionKey (never run session key).",
    "- Never impersonate another agent.",
    "",
    "# EXECUTION REQUIREMENTS",
    `- Work only on this taskId: ${args.task._id}. Do not pick or switch to any other task.`,
    "- Use MCPorter calls in this exact order before execution:",
    `  1) synclaw_agent_pulse(sessionKey="${args.canonicalSessionKey}", status="active")`,
    `  2) synclaw_get_task(taskId="${args.task._id}")`,
    `  3) synclaw_list_messages(taskId="${args.task._id}")`,
    `  4) synclaw_start_task_session(sessionKey="${args.canonicalSessionKey}", taskId="${args.task._id}")`,
    "- After these calls, execute the task immediately.",
    "- Treat this as a direct run-session assignment from GUI comment.",
    "- Post concise progress updates on this same task thread.",
    "- Update only this task status appropriately (in_progress/blocked/review/done).",
    "- If blocked, report the blocker on this task and stop; do not continue to another task.",
    "",
    `Target agent: ${args.selectedAgent.emoji} ${args.selectedAgent.name}`,
  ].join("\n");
}
