#!/usr/bin/env node
/**
 * Sutraha HQ MCP Server
 *
 * Connects AI agents (OpenClaw, etc.) to the Sutraha HQ orchestration dashboard
 * via the Model Context Protocol (MCP).
 *
 * Usage:
 *   CONVEX_URL=... CONVEX_SITE_URL=... SUTRAHA_API_KEY=... SUTRAHA_WORKSPACE_ID=... npx @sutraha/mcp-server
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClientFromEnv } from "./convex-client.js";
import { api } from "./api.js";

const client = createClientFromEnv();

const server = new McpServer({
  name: "sutraha-hq",
  version: "0.1.0",
});

// ═══════════════════════════════════════════════════════════
//  Agent Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_agents",
  "List all active agents in the workspace",
  {},
  async () => {
    const agents = await client.query(api.agents.list);
    return { content: [{ type: "text", text: JSON.stringify(agents, null, 2) }] };
  },
);

server.tool(
  "sutraha_get_agent",
  "Get an agent by ID",
  { agentId: z.string().describe("Agent ID") },
  async ({ agentId }) => {
    const agent = await client.query(api.agents.getById, { id: agentId });
    return { content: [{ type: "text", text: JSON.stringify(agent, null, 2) }] };
  },
);

server.tool(
  "sutraha_get_agent_by_session_key",
  "Find an agent by its session key",
  { sessionKey: z.string().describe("Agent session key") },
  async ({ sessionKey }) => {
    const agent = await client.query(api.agents.getBySessionKey, { sessionKey });
    return { content: [{ type: "text", text: JSON.stringify(agent, null, 2) }] };
  },
);

server.tool(
  "sutraha_update_agent_status",
  "Update an agent's status (active, idle, or blocked)",
  {
    agentId: z.string().describe("Agent ID"),
    status: z.enum(["active", "idle", "blocked"]).describe("New status"),
  },
  async ({ agentId, status }) => {
    await client.mutation(api.agents.updateStatus, { id: agentId, status });
    return { content: [{ type: "text", text: `Agent status updated to ${status}` }] };
  },
);

server.tool(
  "sutraha_agent_heartbeat",
  "Send a heartbeat for an agent to indicate it's alive",
  { agentId: z.string().describe("Agent ID") },
  async ({ agentId }) => {
    await client.rawMutation(api.agents.updateHeartbeat, { id: agentId });
    return { content: [{ type: "text", text: "Heartbeat sent" }] };
  },
);

server.tool(
  "sutraha_agent_pulse",
  "Send a pulse with status and optional telemetry. Use this at startup or during work to indicate you're alive and update your status. This is the 'dead man's switch' — if you don't pulse for 15 minutes, you'll appear offline.",
  {
    agentId: z.string().describe("Your Agent ID"),
    status: z.enum(["idle", "active", "blocked", "error", "offline"]).describe("Current status"),
    telemetry: z
      .object({
        currentModel: z.string().optional().describe("Model name (e.g., 'nvidia-kimi')"),
        openclawVersion: z.string().optional().describe("OpenClaw version (e.g., '2026.2.9')"),
        totalTokensUsed: z.number().optional().describe("Cumulative tokens used by this agent"),
        lastRunDurationMs: z.number().optional().describe("Duration of last run in milliseconds"),
        lastRunCost: z.number().optional().describe("Cost of last run in USD"),
      })
      .optional()
      .describe("Optional telemetry data"),
  },
  async ({ agentId, status, telemetry }) => {
    await client.rawMutation(api.agents.agentPulse, {
      id: agentId,
      status,
      telemetry,
    });
    return {
      content: [
        {
          type: "text",
          text: `Pulse sent: status=${status}${telemetry ? `, telemetry updated` : ""}`,
        },
      ],
    };
  },
);

server.tool(
  "sutraha_start_task_session",
  "Mark that you've started actively working on a task. This links you to the task and logs an activity. Call this when you pick up a task.",
  {
    agentId: z.string().describe("Your Agent ID"),
    taskId: z.string().describe("Task ID you're starting work on"),
  },
  async ({ agentId, taskId }) => {
    await client.rawMutation(api.agents.startTaskSession, {
      agentId,
      taskId,
    });
    return {
      content: [
        {
          type: "text",
          text: `Task session started: you are now actively working on task ${taskId}`,
        },
      ],
    };
  },
);

server.tool(
  "sutraha_end_task_session",
  "Mark that you've finished your current task session. Clears your currentTaskId and updates status. Call this at the end of every run (success or error).",
  {
    agentId: z.string().describe("Your Agent ID"),
    status: z.enum(["idle", "error"]).describe("Final status (idle = success, error = failed)"),
    telemetry: z
      .object({
        currentModel: z.string().optional().describe("Model name"),
        openclawVersion: z.string().optional().describe("OpenClaw version"),
        totalTokensUsed: z.number().optional().describe("Cumulative tokens used"),
        lastRunDurationMs: z.number().optional().describe("Duration of this run in milliseconds"),
        lastRunCost: z.number().optional().describe("Cost of this run in USD"),
      })
      .optional()
      .describe("Telemetry from this run"),
    runSummary: z.string().optional().describe("Short human-readable summary of what was done"),
  },
  async ({ agentId, status, telemetry, runSummary }) => {
    await client.rawMutation(api.agents.endTaskSession, {
      agentId,
      status,
      telemetry,
      runSummary,
    });
    return {
      content: [
        {
          type: "text",
          text: `Task session ended: status=${status}${runSummary ? `, summary: ${runSummary}` : ""}`,
        },
      ],
    };
  },
);

// ═══════════════════════════════════════════════════════════
//  Workspace / Members (human users you can @mention)
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_members",
  "List workspace members (human users). Use this to find the owner and others you can @mention when you need human intervention. Use atMention in message content, e.g. include '@Joy' to tag that member.",
  {},
  async () => {
    const members = await client.query(api.workspaces.getMembers);
    const withHandle = members.map((m: { name?: string; email?: string; role: string }) => {
      const displayName = m.name || m.email || "User";
      const firstWord = displayName.trim().split(/\s+/)[0] || displayName;
      const atMention = `@${firstWord}`;
      return { ...m, displayName, atMention, role: m.role };
    });
    return { content: [{ type: "text", text: JSON.stringify(withHandle, null, 2) }] };
  },
);

// ═══════════════════════════════════════════════════════════
//  Task Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_tasks",
  "List all tasks in the workspace",
  {},
  async () => {
    const tasks = await client.query(api.tasks.list);
    return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
  },
);

server.tool(
  "sutraha_get_task",
  "Get a task by ID with full details",
  { taskId: z.string().describe("Task ID") },
  async ({ taskId }) => {
    const task = await client.query(api.tasks.getById, { id: taskId });
    return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
  },
);

server.tool(
  "sutraha_get_my_tasks",
  "Get tasks assigned to a specific agent",
  { agentId: z.string().describe("Agent ID") },
  async ({ agentId }) => {
    const tasks = await client.query(api.tasks.getByAssignee, { agentId });
    return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
  },
);

server.tool(
  "sutraha_create_task",
  "Create a new task in the workspace. Pass your agentId so the activity is attributed to you.",
  {
    title: z.string().describe("Task title"),
    description: z.string().optional().describe("Task description"),
    status: z.enum(["inbox", "assigned", "in_progress", "review", "done", "blocked"]).optional().describe("Task status (default: inbox)"),
    priority: z.enum(["high", "medium", "low", "none"]).optional().describe("Priority level (default: medium)"),
    assigneeIds: z.array(z.string()).optional().describe("Agent IDs to assign"),
    agentId: z.string().optional().describe("Your Agent ID — activity will be attributed to this agent"),
  },
  async ({ title, description, status, priority, assigneeIds, agentId }) => {
    const id = await client.mutation(api.tasks.create, {
      title,
      description: description ?? "",
      status: status ?? "inbox",
      priority: priority ?? "medium",
      assigneeIds: assigneeIds ?? [],
      dueAt: null,
      ...(agentId ? { actingAgentId: agentId } : {}),
    });
    return { content: [{ type: "text", text: `Task created with ID: ${id}` }] };
  },
);

server.tool(
  "sutraha_update_task",
  "Update a task's fields. Pass your agentId so the activity is attributed to you.",
  {
    taskId: z.string().describe("Task ID"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    priority: z.enum(["high", "medium", "low", "none"]).optional().describe("New priority"),
    assigneeIds: z.array(z.string()).optional().describe("New assignee IDs"),
    agentId: z.string().optional().describe("Your Agent ID — activity will be attributed to this agent"),
  },
  async ({ taskId, agentId, ...updates }) => {
    await client.mutation(api.tasks.update, {
      id: taskId,
      ...updates,
      ...(agentId ? { actingAgentId: agentId } : {}),
    });
    return { content: [{ type: "text", text: `Task ${taskId} updated` }] };
  },
);

server.tool(
  "sutraha_update_task_status",
  "Change a task's status. Pass your agentId so the activity is attributed to you.",
  {
    taskId: z.string().describe("Task ID"),
    status: z.enum(["inbox", "assigned", "in_progress", "review", "done", "blocked"]).describe("New status"),
    agentId: z.string().optional().describe("Your Agent ID — activity will be attributed to this agent"),
  },
  async ({ taskId, status, agentId }) => {
    await client.mutation(api.tasks.updateStatus, {
      id: taskId,
      status,
      ...(agentId ? { actingAgentId: agentId } : {}),
    });
    return { content: [{ type: "text", text: `Task status updated to ${status}` }] };
  },
);

// ═══════════════════════════════════════════════════════════
//  Communication Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_messages",
  "List comments/messages on a task",
  { taskId: z.string().describe("Task ID") },
  async ({ taskId }) => {
    const messages = await client.query(api.messages.list, { taskId });
    return { content: [{ type: "text", text: JSON.stringify(messages, null, 2) }] };
  },
);

server.tool(
  "sutraha_send_message",
  "Post a comment on a task (supports @mentions)",
  {
    content: z.string().describe("Message content (use @agent:name for mentions)"),
    taskId: z.string().describe("Task ID to comment on"),
    agentId: z.string().describe("Agent ID posting the message"),
  },
  async ({ content, taskId, agentId }) => {
    await client.mutation(api.messages.create, { content, taskId, agentId });
    return { content: [{ type: "text", text: "Message sent" }] };
  },
);

server.tool(
  "sutraha_send_chat",
  "Send a chat message as an agent",
  {
    sessionId: z.string().describe("Chat session ID (e.g., chat:agent-session-key)"),
    agentId: z.string().describe("Agent ID sending the message"),
    content: z.string().describe("Message content"),
  },
  async ({ sessionId, agentId, content }) => {
    await client.mutation(api.chatMessages.send, {
      sessionId,
      agentId,
      content,
      fromUser: false,
    });
    return { content: [{ type: "text", text: "Chat message sent" }] };
  },
);

// ═══════════════════════════════════════════════════════════
//  Broadcast Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_broadcasts",
  "List workspace broadcasts",
  {},
  async () => {
    const broadcasts = await client.query(api.broadcasts.list);
    return { content: [{ type: "text", text: JSON.stringify(broadcasts, null, 2) }] };
  },
);

server.tool(
  "sutraha_respond_to_broadcast",
  "Respond to a workspace broadcast. Creates a message and links it as a broadcast response.",
  {
    broadcastId: z.string().describe("Broadcast ID"),
    agentId: z.string().describe("Agent ID responding"),
    content: z.string().describe("Response content"),
  },
  async ({ broadcastId, agentId, content }) => {
    // First create a message attributed to the agent
    const messageId = await client.mutation(api.messages.create, {
      taskId: null,
      agentId,
      content,
    });
    // Then link it to the broadcast
    await client.mutation(api.broadcasts.addResponse, {
      broadcastId,
      messageId,
    });
    return { content: [{ type: "text", text: "Broadcast response sent" }] };
  },
);

// ═══════════════════════════════════════════════════════════
//  Document Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_list_documents",
  "List documents in the workspace",
  { taskId: z.string().optional().describe("Filter by task ID") },
  async ({ taskId }) => {
    const docs = taskId
      ? await client.query(api.documents.getByTask, { taskId })
      : await client.query(api.documents.list);
    return { content: [{ type: "text", text: JSON.stringify(docs, null, 2) }] };
  },
);

server.tool(
  "sutraha_create_document",
  "Create a document in the workspace",
  {
    title: z.string().describe("Document title"),
    content: z.string().describe("Document content (markdown)"),
    type: z.enum(["deliverable", "research", "protocol", "note"]).optional().describe("Document type (default: note)"),
    taskId: z.string().optional().describe("Link to a task"),
    agentId: z.string().describe("Agent ID creating the document"),
  },
  async ({ title, content, type, taskId, agentId }) => {
    const id = await client.mutation(api.documents.create, {
      title,
      content,
      type: type ?? "note",
      taskId: taskId ?? null,
      agentId,
    });
    return { content: [{ type: "text", text: `Document created with ID: ${id}` }] };
  },
);

// ═══════════════════════════════════════════════════════════
//  Activity Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_get_activities",
  "Get recent activity feed for the workspace",
  {},
  async () => {
    const activities = await client.query(api.activities.recent);
    return { content: [{ type: "text", text: JSON.stringify(activities, null, 2) }] };
  },
);

server.tool(
  "sutraha_get_unseen_activities",
  "Get activities that happened since this agent last acknowledged. Use at startup to catch up on what happened while offline.",
  { agentId: z.string().describe("Your Agent ID") },
  async ({ agentId }) => {
    const activities = await client.query(api.activities.getUnseen, { agentId });
    return {
      content: [{
        type: "text",
        text: activities.length === 0
          ? "No new activities since last acknowledgment."
          : `${activities.length} unseen activities:\n${JSON.stringify(activities, null, 2)}`,
      }],
    };
  },
);

server.tool(
  "sutraha_ack_activities",
  "Acknowledge activities as seen. Call this after processing unseen activities so you don't see them again next time.",
  { agentId: z.string().describe("Your Agent ID") },
  async ({ agentId }) => {
    await client.mutation(api.agents.ackActivities, { agentId });
    return { content: [{ type: "text", text: "Activities acknowledged. Watermark updated." }] };
  },
);

// ═══════════════════════════════════════════════════════════
//  Notification Tools
// ═══════════════════════════════════════════════════════════

server.tool(
  "sutraha_get_notifications",
  "Get undelivered @mention notifications for this agent.",
  { agentId: z.string().describe("Your Agent ID") },
  async ({ agentId }) => {
    const notifications = await client.query(api.notifications.getUndelivered, { agentId });
    return {
      content: [{
        type: "text",
        text: notifications.length === 0
          ? "No pending notifications."
          : `${notifications.length} notifications:\n${JSON.stringify(notifications, null, 2)}`,
      }],
    };
  },
);

server.tool(
  "sutraha_ack_notifications",
  "Mark all @mention notifications as delivered for this agent.",
  { agentId: z.string().describe("Your Agent ID") },
  async ({ agentId }) => {
    await client.mutation(api.notifications.markAllDelivered, { agentId });
    return { content: [{ type: "text", text: "All notifications marked as delivered." }] };
  },
);

// ═══════════════════════════════════════════════════════════
//  Start Server
// ═══════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sutraha HQ MCP server running (stdio)");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
