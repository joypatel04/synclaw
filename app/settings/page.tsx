"use client";

import { useMutation } from "convex/react";
import { AlertTriangle, Settings, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { WorkspaceSettingsTabs } from "@/components/settings/WorkspaceSettingsTabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";

function SettingsContent() {
  const { workspace, role, canAdmin, canManage } = useWorkspace();
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
    <div className="app-page">
      <div className="app-page-header mb-6 sm:mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-default/70 bg-bg-tertiary/70">
          <Settings className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <h1 className="app-page-title">Workspace Settings</h1>
          <p className="app-page-subtitle hidden sm:block">
            Manage your workspace configuration
          </p>
        </div>
      </div>

      <WorkspaceSettingsTabs active="general" canManage={canManage} />

      <div className="space-y-8">
        {/* Workspace Name */}
        <div className="rounded-2xl border border-border-default/75 bg-bg-secondary/80 p-4 shadow-[0_12px_26px_rgba(2,8,24,0.16)] sm:p-6">
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
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
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
              <span className="inline-flex items-center rounded-md bg-status-review/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-status-review">
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* Permissions overview */}
        <div className="rounded-2xl border border-border-default/75 bg-bg-secondary/80 p-4 shadow-[0_12px_26px_rgba(2,8,24,0.16)] sm:p-6">
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
          <div className="rounded-2xl border border-status-blocked/35 bg-status-blocked/6 p-4 shadow-[0_12px_24px_rgba(80,12,12,0.14)] sm:p-6">
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
      <Dialog open={showDeleteWorkspace} onOpenChange={setShowDeleteWorkspace}>
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
