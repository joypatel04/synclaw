"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useWorkspace } from "@/components/providers/workspace-provider";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Copy,
  Key,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

function ApiKeysContent() {
  const { workspaceId, canAdmin } = useWorkspace();
  const keys = useQuery(api.apiKeys.list, { workspaceId }) ?? [];
  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRole, setNewKeyRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<Id<"workspaceApiKeys"> | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const result = await createKey({
        workspaceId,
        name: newKeyName.trim(),
        role: newKeyRole,
      });
      setCreatedKey(result.key);
      setNewKeyName("");
      setNewKeyRole("member");
    } catch (error) {
      console.error("Failed to create key:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!revokingId) return;
    await revokeKey({ workspaceId, keyId: revokingId });
    setRevokingId(null);
  };

  const closeCreateDialog = () => {
    setShowCreate(false);
    setCreatedKey(null);
    setCopied(false);
    setNewKeyName("");
    setNewKeyRole("member");
  };

  const activeKeys = keys.filter((k) => k.isActive);
  const revokedKeys = keys.filter((k) => !k.isActive);
  const revokingKeyName =
    revokingId && keys.find((k) => k._id === revokingId)?.name;

  if (!canAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-3 sm:p-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-bg-secondary py-16">
          <ShieldAlert className="h-10 w-10 text-text-dim mb-3" />
          <p className="text-sm text-text-muted">
            Only workspace owners can manage API keys.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-orange/20">
            <Key className="h-4 w-4 text-accent-orange" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary">API Keys</h1>
            <p className="text-xs text-text-muted hidden sm:block">
              Server-to-server authentication for agents and integrations
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          size="sm"
          className="bg-accent-orange hover:bg-accent-orange/90 text-white gap-1.5 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Create Key
        </Button>
      </div>

      {/* Active keys */}
      <div className="space-y-3">
        {activeKeys.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-bg-secondary/50 py-12">
            <Key className="h-8 w-8 text-text-dim mb-3" />
            <p className="text-sm text-text-muted">No API keys yet</p>
            <p className="text-xs text-text-dim mt-1">
              Create a key to connect external agents like OpenClaw
            </p>
          </div>
        )}

        {activeKeys.map((key) => (
          <div
            key={key._id}
            className="flex items-center justify-between rounded-xl border border-border-default bg-bg-secondary p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/20">
                <Key className="h-3.5 w-3.5 text-teal" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">
                    {key.name}
                  </p>
                  <span className="inline-flex items-center rounded-md bg-accent-orange/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-orange">
                    {key.role}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-text-dim">
                  {key.keyPrefix}
                </p>
                <p className="text-[11px] text-text-dim">
                  Created{" "}
                  {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && (
                    <>
                      {" "}
                      · Last used{" "}
                      {new Date(key.lastUsedAt).toLocaleDateString()}
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRevokingId(key._id)}
              className="h-8 w-8 p-0 text-text-muted hover:text-status-blocked hover:bg-status-blocked/10"
              title="Revoke key"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium text-text-dim mb-2">
            Revoked ({revokedKeys.length})
          </p>
          <div className="space-y-2 opacity-50">
            {revokedKeys.map((key) => (
              <div
                key={key._id}
                className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-secondary/50 px-4 py-2.5"
              >
                <Key className="h-3.5 w-3.5 text-text-dim" />
                <div>
                  <p className="text-xs font-medium text-text-muted line-through">
                    {key.name}
                  </p>
                  <p className="font-mono text-[10px] text-text-dim">
                    {key.keyPrefix}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create Key Dialog ── */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog();
        }}
      >
        <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[460px]">
          {!createdKey ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-text-primary">
                  Create API Key
                </DialogTitle>
                <DialogDescription className="text-text-muted">
                  Generate a key for server-to-server authentication. The key
                  will only be shown once.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-text-secondary">Name</Label>
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., OpenClaw Production"
                    className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-text-secondary">Role</Label>
                  <Select
                    value={newKeyRole}
                    onValueChange={(v) =>
                      setNewKeyRole(v as "admin" | "member" | "viewer")
                    }
                  >
                    <SelectTrigger className="bg-bg-primary border-border-default text-text-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-bg-tertiary border-border-default">
                      <SelectItem value="member">
                        Member — read + create/update tasks, messages, docs
                      </SelectItem>
                      <SelectItem value="admin">
                        Admin — everything member + manage agents
                      </SelectItem>
                      <SelectItem value="viewer">
                        Viewer — read-only access
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-text-dim">
                    Determines what operations the key can perform
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeCreateDialog}
                    className="border-border-default text-text-secondary"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!newKeyName.trim() || isCreating}
                    className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                  >
                    {isCreating ? "Creating..." : "Create Key"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-text-primary">
                  API Key Created
                </DialogTitle>
                <DialogDescription className="text-status-review">
                  Copy this key now — it won't be shown again.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <pre className="rounded-lg bg-bg-primary border border-border-default p-3 pr-12 font-mono text-xs text-text-primary break-all whitespace-pre-wrap">
                    {createdKey}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="absolute top-2 right-2 h-7 w-7 p-0 text-text-muted hover:text-text-primary"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-status-active" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="rounded-lg bg-status-review/10 border border-status-review/20 p-3">
                  <p className="text-xs text-status-review">
                    Store this key securely. You won't be able to see it again
                    after closing this dialog.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={closeCreateDialog}
                  className="bg-accent-orange hover:bg-accent-orange/90 text-white"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Revoke Confirmation ── */}
      <Dialog
        open={revokingId !== null}
        onOpenChange={(open) => {
          if (!open) setRevokingId(null);
        }}
      >
        <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-text-primary">Revoke Key</DialogTitle>
            <DialogDescription className="text-text-muted">
              Revoke{" "}
              <span className="font-semibold text-text-primary">
                {revokingKeyName}
              </span>
              ? Any service using this key will immediately lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokingId(null)}
              className="border-border-default text-text-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevoke}
              className="bg-status-blocked hover:bg-status-blocked/90 text-white"
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <AppLayout>
      <ApiKeysContent />
    </AppLayout>
  );
}
