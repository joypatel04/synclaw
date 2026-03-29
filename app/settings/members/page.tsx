"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkspaceSettingsTabs } from "@/components/settings/WorkspaceSettingsTabs";
import {
  Crown,
  Mail,
  MoreHorizontal,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

const roleIcons: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  member: Users,
  viewer: Users,
};

const roleBadgeColors: Record<string, string> = {
  owner: "bg-accent-orange/20 text-accent-orange",
  admin: "bg-status-review/20 text-status-review",
  member: "bg-teal/20 text-teal",
  viewer: "bg-bg-tertiary text-text-muted",
};

function MembersContent() {
  const { workspaceId, role: myRole, canManage } = useWorkspace();
  const members = useQuery(api.workspaces.getMembers, { workspaceId }) ?? [];
  const invites = canManage
    ? (useQuery(api.workspaces.getInvites, { workspaceId }) ?? [])
    : [];
  const inviteMember = useMutation(api.workspaces.invite);
  const updateRole = useMutation(api.workspaces.updateMemberRole);
  const removeMember = useMutation(api.workspaces.removeMember);
  const cancelInvite = useMutation(api.workspaces.cancelInvite);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await inviteMember({
        workspaceId,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteRole("member");
      setShowInvite(false);
    } catch (error) {
      console.error("Failed to invite:", error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (
    memberId: Id<"workspaceMembers">,
    newRole: "admin" | "member" | "viewer",
  ) => {
    try {
      await updateRole({ workspaceId, memberId, newRole });
    } catch (error) {
      console.error("Failed to update role:", error);
    }
  };

  const handleRemove = async (memberId: Id<"workspaceMembers">) => {
    try {
      await removeMember({ workspaceId, memberId });
    } catch (error) {
      console.error("Failed to remove:", error);
    }
  };

  const pendingInvites = invites.filter((i) => i.status === "pending");

  return (
    <div className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary">
          <Settings className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-text-primary">
            Workspace Settings
          </h1>
          <p className="text-xs text-text-muted hidden sm:block">
            Manage members and permissions
          </p>
        </div>
      </div>

      <WorkspaceSettingsTabs active="members" canManage={canManage} />

      {/* Members */}
      <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Users className="h-4 w-4 text-accent-orange" />
            Members ({members.length})
          </h2>
          {canManage && (
            <Button
              onClick={() => setShowInvite(true)}
              size="sm"
              className="bg-accent-orange hover:bg-accent-orange/90 text-white gap-1.5 w-full sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Invite
            </Button>
          )}
        </div>

        <div className="divide-y divide-border-default">
          {members.map((member) => {
            const RoleIcon = roleIcons[member.role] ?? Users;
            const isOwner = member.role === "owner";
            return (
              <div
                key={member._id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-tertiary overflow-hidden">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-text-primary">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {member.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {member.email}
                  </p>
                </div>

                {/* Role badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleBadgeColors[member.role] ?? ""}`}
                >
                  <RoleIcon className="h-3 w-3" />
                  {member.role}
                </span>

                {/* Actions */}
                {canManage && !isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-text-muted hover:text-text-primary"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 bg-bg-tertiary border-border-default"
                    >
                      {myRole === "owner" && member.role !== "admin" && (
                        <DropdownMenuItem
                          onClick={() =>
                            handleRoleChange(
                              member._id as Id<"workspaceMembers">,
                              "admin",
                            )
                          }
                          className="text-text-secondary cursor-pointer"
                        >
                          <Shield className="h-4 w-4 mr-2" /> Make Admin
                        </DropdownMenuItem>
                      )}
                      {member.role === "admin" && (
                        <DropdownMenuItem
                          onClick={() =>
                            handleRoleChange(
                              member._id as Id<"workspaceMembers">,
                              "member",
                            )
                          }
                          className="text-text-secondary cursor-pointer"
                        >
                          <Users className="h-4 w-4 mr-2" /> Make Member
                        </DropdownMenuItem>
                      )}
                      {member.role !== "viewer" && (
                        <DropdownMenuItem
                          onClick={() =>
                            handleRoleChange(
                              member._id as Id<"workspaceMembers">,
                              "viewer",
                            )
                          }
                          className="text-text-secondary cursor-pointer"
                        >
                          <Users className="h-4 w-4 mr-2" /> Make Viewer
                        </DropdownMenuItem>
                      )}
                      {member.role === "viewer" && (
                        <DropdownMenuItem
                          onClick={() =>
                            handleRoleChange(
                              member._id as Id<"workspaceMembers">,
                              "member",
                            )
                          }
                          className="text-text-secondary cursor-pointer"
                        >
                          <Users className="h-4 w-4 mr-2" /> Make Member
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() =>
                          handleRemove(member._id as Id<"workspaceMembers">)
                        }
                        className="text-status-blocked cursor-pointer"
                      >
                        <UserMinus className="h-4 w-4 mr-2" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invites */}
      {canManage && pendingInvites.length > 0 && (
        <div className="mt-6 rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Mail className="h-4 w-4 text-status-review" />
            Pending Invites ({pendingInvites.length})
          </h2>
          <div className="divide-y divide-border-default">
            {pendingInvites.map((invite) => (
              <div
                key={invite._id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-tertiary">
                  <Mail className="h-4 w-4 text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {invite.email}
                  </p>
                  <p className="text-xs text-text-muted">
                    Invited as <span className="capitalize">{invite.role}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    cancelInvite({
                      workspaceId,
                      inviteId: invite._id as Id<"workspaceInvites">,
                    })
                  }
                  className="h-7 w-7 text-text-muted hover:text-status-blocked"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-text-primary">
              Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-text-secondary">Email Address</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-text-secondary">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as typeof inviteRole)}
              >
                <SelectTrigger className="bg-bg-primary border-border-default text-text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default">
                  {myRole === "owner" && (
                    <SelectItem value="admin">Admin</SelectItem>
                  )}
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-text-dim">
                {inviteRole === "admin"
                  ? "Can manage agents, delete tasks, and invite members"
                  : inviteRole === "member"
                    ? "Can create tasks, comment, and chat"
                    : "Read-only access to the workspace"}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInvite(false)}
                className="border-border-default text-text-secondary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!inviteEmail.trim() || isInviting}
                className="bg-accent-orange hover:bg-accent-orange/90 text-white"
              >
                {isInviting ? "Sending..." : "Send Invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MembersPage() {
  return (
    <AppLayout>
      <MembersContent />
    </AppLayout>
  );
}
