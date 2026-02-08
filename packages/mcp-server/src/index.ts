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
    await client.mutation(api.agents.updateHeartbeat, { id: agentId });
    return { content: [{ type: "text", text: "Heartbeat sent" }] };
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
  "Create a new task in the workspace",
  {
    title: z.string().describe("Task title"),
    description: z.string().optional().describe("Task description"),
    status: z.enum(["inbox", "assigned", "in_progress", "review", "done", "blocked"]).optional().describe("Task status (default: inbox)"),
    priority: z.enum(["high", "medium", "low", "none"]).optional().describe("Priority level (default: medium)"),
    assigneeIds: z.array(z.string()).optional().describe("Agent IDs to assign"),
  },
  async ({ title, description, status, priority, assigneeIds }) => {
    const id = await client.mutation(api.tasks.create, {
      title,
      description: description ?? "",
      status: status ?? "inbox",
      priority: priority ?? "medium",
      assigneeIds: assigneeIds ?? [],
    });
    return { content: [{ type: "text", text: `Task created with ID: ${id}` }] };
  },
);

server.tool(
  "sutraha_update_task",
  "Update a task's fields",
  {
    taskId: z.string().describe("Task ID"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    priority: z.enum(["high", "medium", "low", "none"]).optional().describe("New priority"),
    assigneeIds: z.array(z.string()).optional().describe("New assignee IDs"),
  },
  async ({ taskId, ...updates }) => {
    await client.mutation(api.tasks.update, { id: taskId, ...updates });
    return { content: [{ type: "text", text: `Task ${taskId} updated` }] };
  },
);

server.tool(
  "sutraha_update_task_status",
  "Change a task's status",
  {
    taskId: z.string().describe("Task ID"),
    status: z.enum(["inbox", "assigned", "in_progress", "review", "done", "blocked"]).describe("New status"),
  },
  async ({ taskId, status }) => {
    await client.mutation(api.tasks.updateStatus, { id: taskId, status });
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
  "Respond to a workspace broadcast",
  {
    broadcastId: z.string().describe("Broadcast ID"),
    agentId: z.string().describe("Agent ID responding"),
    content: z.string().describe("Response content"),
  },
  async ({ broadcastId, agentId, content }) => {
    await client.mutation(api.broadcasts.addResponse, {
      broadcastId,
      agentId,
      content,
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
