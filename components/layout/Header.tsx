"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  FileText,
  FolderTree,
  Key,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Plus,
  Radio,
  Settings,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  OPENCLAW_FILES_ENABLED,
  WEBHOOKS_ENABLED,
} from "@/lib/features";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/broadcasts", label: "Broadcasts", icon: Radio },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/help", label: "Resources", icon: LifeBuoy },
];

export function Header({ onboardingLocked }: { onboardingLocked?: boolean }) {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const { workspace, workspaces, switchWorkspace, role } = useWorkspace();
  const createWorkspace = useMutation(api.workspaces.create);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const navItems = OPENCLAW_FILES_ENABLED
    ? [
        ...baseNavItems.slice(0, 5),
        { href: "/filesystem", label: "Filesystem", icon: FolderTree },
        baseNavItems[5],
      ]
    : baseNavItems;

  const handleCreateWorkspace = async () => {
    if (!newName.trim()) return;
    const id = await createWorkspace({ name: newName.trim() });
    switchWorkspace(id as Id<"workspaces">);
    setNewName("");
    setShowCreate(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border-default bg-bg-secondary/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Logo + Workspace Switcher */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-orange/20">
                <Zap className="h-4 w-4 text-accent-orange" />
              </div>
            </Link>

            {/* Workspace Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-text-primary hover:bg-bg-hover transition-smooth"
                >
                  {workspace.name}
                  <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-64 bg-bg-tertiary border-border-default"
              >
                <div className="px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                    Workspaces
                  </p>
                </div>
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws._id}
                    onClick={() => switchWorkspace(ws._id as Id<"workspaces">)}
                    className="flex items-center justify-between text-text-secondary cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-bg-primary text-[10px] font-bold text-accent-orange">
                        {ws.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm truncate max-w-[160px]">
                        {ws.name}
                      </span>
                    </div>
                    {ws._id === workspace._id && (
                      <Check className="h-4 w-4 text-accent-orange" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-border-default" />
                <DropdownMenuItem
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 text-accent-orange cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Create Workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Role badge */}
            <span className="hidden sm:inline-flex items-center rounded-md bg-accent-orange/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-orange">
              {role}
            </span>
          </div>

          {/* Navigation */}
          {!onboardingLocked && (
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-smooth",
                      isActive
                        ? "bg-accent-orange/10 text-accent-orange"
                        : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Theme toggle + User Menu */}
          <div className="flex items-center gap-2">
            {onboardingLocked && (
              <>
                <Button
                  asChild
                  size="icon-sm"
                  className="sm:hidden bg-accent-orange hover:bg-accent-orange/90 text-white"
                >
                  <Link href="/onboarding" aria-label="Finish setup">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="hidden sm:inline-flex bg-accent-orange hover:bg-accent-orange/90 text-white"
                >
                  <Link href="/onboarding">Finish setup</Link>
                </Button>
              </>
            )}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full bg-accent-orange/20 text-accent-orange hover:bg-accent-orange/30"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-bg-tertiary border-border-default"
              >
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 text-text-secondary"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings/members"
                    className="flex items-center gap-2 text-text-secondary"
                  >
                    <Users className="h-4 w-4" />
                    Members
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings/api-keys"
                    className="flex items-center gap-2 text-text-secondary"
                  >
                    <Key className="h-4 w-4" />
                    API Keys
                  </Link>
                </DropdownMenuItem>
                {WEBHOOKS_ENABLED ? (
                  <DropdownMenuItem asChild>
                    <Link
                      href="/settings/webhooks"
                      className="flex items-center gap-2 text-text-secondary"
                    >
                      <Webhook className="h-4 w-4" />
                      Webhooks
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator className="bg-border-default" />
                <DropdownMenuItem
                  onClick={() => void signOut()}
                  className="flex items-center gap-2 text-status-blocked cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav */}
        {!onboardingLocked && (
          <nav className="flex md:hidden items-center gap-1 px-4 pb-2 overflow-x-auto">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-smooth",
                    isActive
                      ? "bg-accent-orange/10 text-accent-orange"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Create Workspace Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-text-primary">
              Create Workspace
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-text-secondary">Workspace Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Acme Corp"
              className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim"
              onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="border-border-default text-text-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              disabled={!newName.trim()}
              className="bg-accent-orange hover:bg-accent-orange/90 text-white"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
