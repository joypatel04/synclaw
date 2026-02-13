#!/usr/bin/env node
import { api } from "./api.js";
/**
 * Sutraha HQ CLI
 *
 * Command-line interface for interacting with the Sutraha HQ backend.
 * Useful for debugging and manual operations.
 *
 * Usage:
 *   sutraha-cli <resource> <action> [options]
 *
 * Examples:
 *   sutraha-cli agents list
 *   sutraha-cli tasks list
 *   sutraha-cli tasks create --title "Fix bug" --priority high
 *   sutraha-cli tasks update-status --id <id> --status done
 *   sutraha-cli chat send --session-id chat:key --message "Hello"
 */
import { createClientFromEnv } from "./convex-client.js";

const client = createClientFromEnv();

function usage() {
  console.log(
    `
Sutraha HQ CLI

Usage: sutraha-cli <resource> <action> [options]

Resources:
  agents     list | get --id <id> | heartbeat --id <id> | status --id <id> --status <active|idle|error|offline>
  tasks      list | get --id <id> | create --title <t> | update-status --id <id> --status <s>
  messages   list --task-id <id> | send --task-id <id> --agent-id <id> --content <msg>
  chat       send --session-id <sid> --message <msg>
  broadcasts list
  documents  list | create --title <t> --content <c> --agent-id <id> [--status draft|final|archived]
  activities list

Environment variables:
  CONVEX_URL             Convex cloud URL
  CONVEX_SITE_URL        Convex site URL (for token exchange)
  SUTRAHA_API_KEY        Workspace API key
  SUTRAHA_WORKSPACE_ID   Workspace ID
  `.trim(),
  );
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function requireArg(args: string[], flag: string, name: string): string {
  const val = getArg(args, flag);
  if (!val) {
    console.error(`Missing required option: ${flag} <${name}>`);
    process.exit(1);
  }
  return val;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args[0] === "--help" || args[0] === "-h") {
    usage();
    process.exit(0);
  }

  const [resource, action, ...rest] = args;

  try {
    let result: unknown;

    switch (resource) {
      case "agents":
        switch (action) {
          case "list":
            result = await client.query(api.agents.list);
            break;
          case "get":
            result = await client.query(api.agents.getById, {
              id: requireArg(rest, "--id", "agentId"),
            });
            break;
          case "heartbeat":
            await client.mutation(api.agents.updateHeartbeat, {
              id: requireArg(rest, "--id", "agentId"),
            });
            result = { ok: true };
            break;
          case "status":
            await client.mutation(api.agents.updateStatus, {
              id: requireArg(rest, "--id", "agentId"),
              status: requireArg(rest, "--status", "status"),
            });
            result = { ok: true };
            break;
          default:
            console.error(`Unknown agents action: ${action}`);
            process.exit(1);
        }
        break;

      case "tasks":
        switch (action) {
          case "list":
            result = await client.query(api.tasks.list);
            break;
          case "get":
            result = await client.query(api.tasks.getById, {
              id: requireArg(rest, "--id", "taskId"),
            });
            break;
          case "create":
            result = await client.mutation(api.tasks.create, {
              title: requireArg(rest, "--title", "title"),
              description: getArg(rest, "--description") ?? "",
              status: getArg(rest, "--status") ?? "inbox",
              priority: getArg(rest, "--priority") ?? "medium",
              assigneeIds: [],
            });
            break;
          case "update-status":
            await client.mutation(api.tasks.updateStatus, {
              id: requireArg(rest, "--id", "taskId"),
              status: requireArg(rest, "--status", "status"),
            });
            result = { ok: true };
            break;
          default:
            console.error(`Unknown tasks action: ${action}`);
            process.exit(1);
        }
        break;

      case "messages":
        switch (action) {
          case "list":
            result = await client.query(api.messages.list, {
              taskId: requireArg(rest, "--task-id", "taskId"),
            });
            break;
          case "send":
            await client.mutation(api.messages.create, {
              content: requireArg(rest, "--content", "content"),
              taskId: requireArg(rest, "--task-id", "taskId"),
              agentId: requireArg(rest, "--agent-id", "agentId"),
            });
            result = { ok: true };
            break;
          default:
            console.error(`Unknown messages action: ${action}`);
            process.exit(1);
        }
        break;

      case "chat":
        switch (action) {
          case "send":
            await client.mutation(api.chatMessages.send, {
              sessionId: requireArg(rest, "--session-id", "sessionId"),
              content: requireArg(rest, "--message", "message"),
              fromUser: false,
              role: "assistant",
              state: "completed",
            });
            result = { ok: true };
            break;
          default:
            console.error(`Unknown chat action: ${action}`);
            process.exit(1);
        }
        break;

      case "broadcasts":
        switch (action) {
          case "list":
            result = await client.query(api.broadcasts.list);
            break;
          default:
            console.error(`Unknown broadcasts action: ${action}`);
            process.exit(1);
        }
        break;

      case "documents":
        switch (action) {
          case "list":
            result = await client.query(api.documents.list);
            break;
          case "create":
            result = await client.mutation(api.documents.create, {
              title: requireArg(rest, "--title", "title"),
              content: requireArg(rest, "--content", "content"),
              type: getArg(rest, "--type") ?? "note",
              status: getArg(rest, "--status") ?? "draft",
              taskId: getArg(rest, "--task-id") ?? null,
              agentId: requireArg(rest, "--agent-id", "agentId"),
            });
            break;
          default:
            console.error(`Unknown documents action: ${action}`);
            process.exit(1);
        }
        break;

      case "activities":
        switch (action) {
          case "list":
            result = await client.query(api.activities.recent);
            break;
          default:
            console.error(`Unknown activities action: ${action}`);
            process.exit(1);
        }
        break;

      default:
        console.error(`Unknown resource: ${resource}`);
        usage();
        process.exit(1);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error:", message);
    process.exit(1);
  }
}

main();
