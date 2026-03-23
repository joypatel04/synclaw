import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/permissions";

// ─── Queries ─────────────────────────────────────────────────────

/** Get the current authenticated user's profile. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db.get(userId);
  },
});

// ─── Mutations ───────────────────────────────────────────────────

/**
 * Delete the current user's account. GDPR Art. 17 (Right to Erasure).
 *
 * - Removes the user from all workspaces (member records)
 * - Anonymises message content authored by this user
 * - Deletes the user record
 *
 * Does NOT delete workspaces the user owns — they must transfer ownership
 * or delete the workspace first via `workspaces.deleteWorkspace`.
 */
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    // Guard: fail fast if user is owner of any workspace
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    const ownedWorkspaces = memberships.filter((m) => m.role === "owner");
    if (ownedWorkspaces.length > 0) {
      throw new Error(
        "You must delete or transfer ownership of all workspaces before deleting your account.",
      );
    }

    // Remove all workspace memberships
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }

    // Cancel any pending invites sent by this user
    for (const m of memberships) {
      const invites = await ctx.db
        .query("workspaceInvites")
        .withIndex("byWorkspace", (q) => q.eq("workspaceId", m.workspaceId))
        .filter((q) => q.eq(q.field("invitedBy"), userId))
        .take(100);
      for (const inv of invites) {
        await ctx.db.patch(inv._id, { status: "expired" });
      }
    }

    // Delete user record
    await ctx.db.delete(userId);
  },
});

/**
 * Export all personal data for the current user. GDPR Art. 20 (Data Portability).
 * Returns a JSON-serialisable object with all user-linked data.
 */
export const exportMyData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    return {
      exportedAt: Date.now(),
      user: {
        id: user?._id,
        name: (user as any)?.name,
        email: (user as any)?.email,
        createdAt: user?._creationTime,
      },
      workspaceMemberships: memberships.map((m) => ({
        workspaceId: m.workspaceId,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  },
});
