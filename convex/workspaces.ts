import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireAuth,
  requireRole,
  requireMember,
  getUserDisplayName,
} from "./lib/permissions";

// ─── Queries ─────────────────────────────────────────────────────

/** Get all workspaces the current user is a member of. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const ws = await ctx.db.get(m.workspaceId);
        return ws ? { ...ws, role: m.role, membershipId: m._id } : null;
      }),
    );
    return workspaces.filter(Boolean);
  },
});

/** Get a single workspace by ID (must be member). */
export const getById = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const membership = await requireMember(ctx, args.workspaceId);
    const workspace = await ctx.db.get(args.workspaceId);
    return workspace ? { ...workspace, role: membership.role } : null;
  },
});

/** Get all members of a workspace. */
export const getMembers = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.workspaceId);
    const members = await ctx.db
      .query("workspaceMembers")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          ...m,
          name: (user as any)?.name ?? (user as any)?.email ?? "User",
          email: (user as any)?.email ?? "",
          image: (user as any)?.image ?? null,
        };
      }),
    );
  },
});

/** Get pending invites for a workspace (admin+). */
export const getInvites = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "admin");
    return await ctx.db
      .query("workspaceInvites")
      .withIndex("byWorkspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

// ─── Mutations ───────────────────────────────────────────────────

/** Create a new workspace. The creator becomes the owner. */
export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const now = Date.now();

    // Generate slug from name
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 48);

    // Check uniqueness — append random suffix if needed
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("bySlug", (q) => q.eq("slug", slug))
      .first();
    const finalSlug = existing
      ? `${slug}-${Math.random().toString(36).substring(2, 6)}`
      : slug;

    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name.trim(),
      slug: finalSlug,
      createdAt: now,
    });

    // Add creator as owner
    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId,
      role: "owner",
      joinedAt: now,
    });

    // Log workspace creation
    const displayName = await getUserDisplayName(ctx, userId);
    await ctx.db.insert("activities", {
      workspaceId,
      type: "task_created",
      agentId: null,
      taskId: null,
      message: `${displayName} created workspace "${args.name}"`,
      metadata: { action: "workspace_created" },
      createdAt: now,
    });

    return workspaceId;
  },
});

/**
 * Get-or-create a default workspace for a new user.
 * Called automatically when a user first logs in with no workspaces.
 */
export const getOrCreateDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    // Check if user already has workspaces
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("byUser", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      return existing.workspaceId;
    }

    // Create default workspace
    const displayName = await getUserDisplayName(ctx, userId);
    const name = `${displayName}'s Workspace`;
    const now = Date.now();
    const slug = `ws-${Math.random().toString(36).substring(2, 10)}`;

    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      slug,
      createdAt: now,
    });

    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId,
      role: "owner",
      joinedAt: now,
    });

    return workspaceId;
  },
});

/** Invite a user by email (admin+). */
export const invite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const membership = await requireRole(ctx, args.workspaceId, "admin");

    // Check for duplicate invite
    const existingInvite = await ctx.db
      .query("workspaceInvites")
      .withIndex("byEmail", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();
    const duplicate = existingInvite.find(
      (inv) =>
        inv.workspaceId === args.workspaceId && inv.status === "pending",
    );
    if (duplicate) throw new Error("Invite already pending for this email");

    return await ctx.db.insert("workspaceInvites", {
      workspaceId: args.workspaceId,
      email: args.email.toLowerCase().trim(),
      role: args.role,
      invitedBy: membership.userId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/**
 * Accept any pending invites for the current user's email.
 * Called automatically after login.
 */
export const acceptPendingInvites = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    const email = (user as any)?.email;
    if (!email) return [];

    const pendingInvites = await ctx.db
      .query("workspaceInvites")
      .withIndex("byEmail", (q) => q.eq("email", email.toLowerCase()))
      .collect();

    const accepted: string[] = [];
    for (const invite of pendingInvites) {
      if (invite.status !== "pending") continue;

      // Check not already a member
      const existing = await ctx.db
        .query("workspaceMembers")
        .withIndex("byWorkspaceAndUser", (q) =>
          q.eq("workspaceId", invite.workspaceId).eq("userId", userId),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("workspaceMembers", {
          workspaceId: invite.workspaceId,
          userId,
          role: invite.role,
          joinedAt: Date.now(),
        });
        accepted.push(invite.workspaceId);
      }
      await ctx.db.patch(invite._id, { status: "accepted" });
    }
    return accepted;
  },
});

/** Update a member's role (admin+, but only owner can set admin). */
export const updateMemberRole = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    memberId: v.id("workspaceMembers"),
    newRole: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const myMembership = await requireRole(ctx, args.workspaceId, "admin");
    const targetMember = await ctx.db.get(args.memberId);
    if (!targetMember || targetMember.workspaceId !== args.workspaceId) {
      throw new Error("Member not found");
    }

    // Can't change own role
    if (targetMember.userId === myMembership.userId) {
      throw new Error("Cannot change your own role");
    }
    // Only owner can promote to admin
    if (args.newRole === "admin" && myMembership.role !== "owner") {
      throw new Error("Only the owner can promote to admin");
    }
    // Can't change owner's role
    if (targetMember.role === "owner") {
      throw new Error("Cannot change the owner's role");
    }

    await ctx.db.patch(args.memberId, { role: args.newRole });
  },
});

/** Remove a member from the workspace (admin+). */
export const removeMember = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    memberId: v.id("workspaceMembers"),
  },
  handler: async (ctx, args) => {
    const myMembership = await requireRole(ctx, args.workspaceId, "admin");
    const targetMember = await ctx.db.get(args.memberId);
    if (!targetMember || targetMember.workspaceId !== args.workspaceId) {
      throw new Error("Member not found");
    }
    if (targetMember.role === "owner") {
      throw new Error("Cannot remove the workspace owner");
    }
    if (targetMember.userId === myMembership.userId) {
      throw new Error("Cannot remove yourself");
    }

    await ctx.db.delete(args.memberId);
  },
});

/** Cancel a pending invite (admin+). */
export const cancelInvite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    inviteId: v.id("workspaceInvites"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "admin");
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.workspaceId !== args.workspaceId) {
      throw new Error("Invite not found");
    }
    await ctx.db.patch(args.inviteId, { status: "expired" });
  },
});

/** Update workspace name (owner only). */
export const updateName = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.workspaceId, "owner");
    await ctx.db.patch(args.workspaceId, { name: args.name.trim() });
  },
});
