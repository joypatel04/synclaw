"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { WEBHOOKS_ENABLED } from "@/lib/features";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

function SettingsContent() {
  const { workspace, role, canAdmin } = useWorkspace();
  const updateName = useMutation(api.workspaces.updateName);
  const deleteWorkspace = useMutation(api.workspaces.deleteWorkspace);
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteWorkspace, setShowDeleteWorkspace] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteWorkspace = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteWorkspace({ workspaceId: workspace._id });
      router.push("/");
    } catch (error: any) {
      setDeleteError(error?.message ?? "Failed to delete workspace.");
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || name === workspace.name) return;
    setIsSaving(true);
    try {
      await updateName({ workspaceId: workspace._id, name: name.trim() });
    } catch (error) {
      console.error("Failed to update:", error);
    } finally {
      setIsSaving(false);
    }
  };

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
            Manage your workspace configuration
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 mb-8 border-b border-border-default">
        <Link
          href="/settings"
          className="border-b-2 border-accent-orange px-4 py-2.5 text-sm font-medium text-accent-orange"
        >
          General
        </Link>
        <Link
          href="/settings/members"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
        >
          Members
        </Link>
        <Link
          href="/settings/openclaw"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
        >
          OpenClaw
        </Link>
        {WEBHOOKS_ENABLED ? (
          <Link
            href="/settings/webhooks"
            className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
          >
            Webhooks
          </Link>
        ) : null}
        <Link
          href="/settings/account"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
        >
          Account
        </Link>
      </div>

      <div className="space-y-8">
        {/* Workspace Name */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Workspace Details
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-text-secondary">Workspace Name</Label>
              {canAdmin ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                  />
                  <Button
                    onClick={handleSave}
                    disabled={
                      !name.trim() || name === workspace.name || isSaving
                    }
                    size="sm"
                    className="bg-accent-orange hover:bg-accent-orange/90 text-white shrink-0"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-text-primary bg-bg-primary border border-border-default rounded-md px-3 py-2">
                  {workspace.name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-text-secondary">Workspace Slug</Label>
              <p className="text-sm text-text-muted font-mono bg-bg-primary border border-border-default rounded-md px-3 py-2">
                {workspace.slug}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-text-secondary">Your Role</Label>
              <span className="inline-flex items-center rounded-md bg-accent-orange/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent-orange">
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* Permissions overview */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Role Permissions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">
                    Action
                  </th>
                  <th className="text-center py-2 px-3 text-text-muted font-medium">
                    Viewer
                  </th>
                  <th className="text-center py-2 px-3 text-text-muted font-medium">
                    Member
                  </th>
                  <th className="text-center py-2 px-3 text-text-muted font-medium">
                    Admin
                  </th>
                  <th className="text-center py-2 px-3 text-text-muted font-medium">
                    Owner
                  </th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                {[
                  ["View dashboard & tasks", true, true, true, true],
                  ["Create & update tasks", false, true, true, true],
                  ["Post comments & chat", false, true, true, true],
                  ["Create broadcasts", false, true, true, true],
                  ["Delete tasks", false, false, true, true],
                  ["Manage agents", false, false, true, true],
                  ["Invite & remove members", false, false, true, true],
                  ["Workspace settings", false, false, false, true],
                ].map(([action, v, m, a, o]) => (
                  <tr
                    key={action as string}
                    className="border-b border-border-default/50"
                  >
                    <td className="py-2 pr-4">{action as string}</td>
                    {[v, m, a, o].map((has, i) => (
                      <td key={i} className="text-center py-2 px-3">
                        {has ? (
                          <span className="text-status-active">&#10003;</span>
                        ) : (
                          <span className="text-text-dim">&#8211;</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Danger Zone — owner only */}
        {role === "owner" && (
          <div className="rounded-xl border border-status-blocked/30 bg-bg-secondary p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-status-blocked mb-1 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Permanently delete this workspace and all its data. This cannot be
              undone.
            </p>
            <Button
              onClick={() => setShowDeleteWorkspace(true)}
              size="sm"
              variant="outline"
              className="border-status-blocked/50 text-status-blocked hover:bg-status-blocked/10 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Workspace
            </Button>
          </div>
        )}
      </div>

      {/* Delete Workspace Confirmation */}
      <Dialog
        open={showDeleteWorkspace}
        onOpenChange={setShowDeleteWorkspace}
      >
        <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-text-primary">
              Delete Workspace
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              This will permanently delete{" "}
              <span className="font-semibold text-text-primary">
                {workspace.name}
              </span>{" "}
              and all its agents, tasks, documents, and data. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-xs text-status-blocked bg-status-blocked/10 rounded-lg px-3 py-2">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteWorkspace(false);
                setDeleteError(null);
              }}
              className="border-border-default text-text-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteWorkspace}
              disabled={isDeleting}
              className="bg-status-blocked hover:bg-status-blocked/90 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppLayout>
      <SettingsContent />
    </AppLayout>
  );
}
