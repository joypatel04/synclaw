"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Settings, Download, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { WEBHOOKS_ENABLED } from "@/lib/features";
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";

function AccountContent() {
  const { workspaceId } = useWorkspace();
  const { signOut } = useAuthActions();
  const router = useRouter();

  const me = useQuery(api.users.me);
  const deleteMyAccount = useMutation(api.users.deleteMyAccount);
  const exportMyData = useQuery(api.users.exportMyData);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleExportData = () => {
    if (!exportMyData) return;
    const blob = new Blob([JSON.stringify(exportMyData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `synclaw-data-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount({});
      await signOut();
      router.push("/");
    } catch (error: any) {
      setDeleteError(error?.message ?? "Failed to delete account.");
      setIsDeleting(false);
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
            Manage your account and data
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-border-default">
        <Link
          href="/settings"
          className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-smooth"
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
          className="border-b-2 border-accent-orange px-4 py-2.5 text-sm font-medium text-accent-orange"
        >
          Account
        </Link>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        {me && (
          <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4">
              Your Profile
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-tertiary overflow-hidden">
                {(me as any).image ? (
                  <img
                    src={(me as any).image}
                    alt={(me as any).name ?? "User"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-text-primary">
                    {((me as any).name ?? "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {(me as any).name ?? "Unknown"}
                </p>
                <p className="text-xs text-text-muted">
                  {(me as any).email ?? ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Data Export */}
        <div className="rounded-xl border border-border-default bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-1">
            Export Your Data
          </h2>
          <p className="text-xs text-text-muted mb-4">
            Download a copy of your personal data. Includes your profile and
            workspace memberships. (GDPR Art. 20)
          </p>
          <Button
            onClick={handleExportData}
            disabled={!exportMyData}
            size="sm"
            variant="outline"
            className="border-border-default text-text-secondary gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Download Data Export
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border border-status-blocked/30 bg-bg-secondary p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-status-blocked mb-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </h2>
          <p className="text-xs text-text-muted mb-4">
            Permanently delete your account and remove yourself from all
            workspaces. You must delete or transfer ownership of any workspaces
            you own first.
          </p>
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            size="sm"
            variant="outline"
            className="border-status-blocked/50 text-status-blocked hover:bg-status-blocked/10 gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete My Account
          </Button>
        </div>
      </div>

      {/* Delete Account Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-text-primary">
              Delete Your Account
            </DialogTitle>
            <DialogDescription className="text-text-muted">
              This will permanently delete your account and remove you from all
              workspaces. This action cannot be undone.
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
                setShowDeleteConfirm(false);
                setDeleteError(null);
              }}
              className="border-border-default text-text-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-status-blocked hover:bg-status-blocked/90 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AccountPage() {
  return (
    <AppLayout>
      <AccountContent />
    </AppLayout>
  );
}
