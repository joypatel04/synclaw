import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

// ─── Role Types ──────────────────────────────────────────────────

export type Role = "owner" | "admin" | "member" | "viewer";

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

// ─── Permission Map ──────────────────────────────────────────────
// Minimum role required for each action category:
//   viewer  → read-only (view dashboard, tasks, feed, docs)
//   member  → create/update tasks, comment, chat, create broadcasts
//   admin   → delete tasks, manage agents, invite/remove members
//   owner   → workspace settings, delete workspace, transfer ownership

// ─── Auth Helpers ────────────────────────────────────────────────

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function getAuthUserOptional(ctx: QueryCtx | MutationCtx) {
  return await getAuthUserId(ctx);
}

// ─── Workspace Membership ────────────────────────────────────────

export async function getMembership(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  return await ctx.db
    .query("workspaceMembers")
    .withIndex("byWorkspaceAndUser", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId),
    )
    .first();
}

/**
 * Require the current user to be a member of the workspace.
 * Returns the membership document.
 */
export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const membership = await getMembership(ctx, workspaceId);
  if (!membership) throw new Error("Not a member of this workspace");
  return membership;
}

/**
 * Require the current user to have at least `minimumRole` in the workspace.
 * Role hierarchy: owner > admin > member > viewer
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  minimumRole: Role,
) {
  const membership = await requireMember(ctx, workspaceId);
  if (ROLE_HIERARCHY[membership.role as Role] < ROLE_HIERARCHY[minimumRole]) {
    throw new Error(
      `Insufficient permissions: requires ${minimumRole} role or higher`,
    );
  }
  return membership;
}

/**
 * Check if a role meets the minimum requirement (no DB call).
 */
export function hasMinRole(userRole: Role, minimumRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

// ─── User Profile ────────────────────────────────────────────────

/**
 * Get the current user's display name from their auth profile.
 */
export async function getUserDisplayName(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<string> {
  const user = await ctx.db.get(userId);
  if (!user) return "Unknown";
  // Auth tables store name and email
  return (user as any).name ?? (user as any).email ?? "User";
}

/**
 * Resolve the display name for an actor.
 * If actingAgentId is provided, returns the agent's emoji + name (e.g. "🤖 Shuri").
 * Otherwise falls back to the user's display name.
 * Also returns the agentId for the activity record.
 */
export async function resolveActorName(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  actingAgentId?: Id<"agents"> | null,
): Promise<{ displayName: string; agentId: Id<"agents"> | null }> {
  if (actingAgentId) {
    const agent = await ctx.db.get(actingAgentId);
    if (agent) {
      return {
        displayName: `${agent.emoji} ${agent.name}`,
        agentId: agent._id,
      };
    }
  }
  const displayName = await getUserDisplayName(ctx, userId);
  return { displayName, agentId: null };
}
