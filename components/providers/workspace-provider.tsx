"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAllowedWhileLocked as isAllowedWhileLockedRoute } from "@/lib/onboardingGate";

// ─── Types ───────────────────────────────────────────────────────

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceContext {
  workspaceId: Id<"workspaces">;
  membershipId: Id<"workspaceMembers">;
  workspace: {
    _id: Id<"workspaces">;
    name: string;
    slug: string;
    role: string;
    membershipId: Id<"workspaceMembers">;
  };
  role: WorkspaceRole;
  workspaces: Array<{
    _id: Id<"workspaces">;
    name: string;
    slug: string;
    role: string;
    membershipId: Id<"workspaceMembers">;
  }>;
  switchWorkspace: (id: Id<"workspaces">) => void;
  isLoading: boolean;
  /** Permission checks */
  canEdit: boolean;   // member+
  canManage: boolean;  // admin+
  canAdmin: boolean;   // owner
}

const Ctx = createContext<WorkspaceContext | null>(null);

// ─── Hook ────────────────────────────────────────────────────────

export function useWorkspace(): WorkspaceContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be inside WorkspaceProvider");
  return ctx;
}

// ─── Storage helpers ─────────────────────────────────────────────

const STORAGE_KEY = "synclaw-hq:active-workspace";

function loadSaved(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function persist(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

// ─── Provider ────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const workspaces = useQuery(api.workspaces.listMine) as
    | Array<{
        _id: Id<"workspaces">;
        name: string;
        slug: string;
        role: string;
        membershipId: Id<"workspaceMembers">;
      }>
    | undefined;
  const getOrCreate = useMutation(api.workspaces.getOrCreateDefault);
  const acceptInvites = useMutation(api.workspaces.acceptPendingInvites);

  const [activeId, setActiveId] = useState<string | null>(loadSaved);
  const [initialised, setInitialised] = useState(false);
  const [requestedDefault, setRequestedDefault] = useState(false);

  // On first load, accept any pending invites
  useEffect(() => {
    if (!initialised && workspaces !== undefined) {
      void acceptInvites();
      setInitialised(true);
    }
  }, [workspaces, initialised, acceptInvites]);

  // Auto-create default workspace if user has none
  useEffect(() => {
    if (!workspaces) return;
    if (workspaces.length !== 0) return;
    if (requestedDefault) return;

    setRequestedDefault(true);
    void getOrCreate().then((id) => {
      setActiveId(id);
      persist(id);

      // New users land on "/" after OAuth; route them directly into onboarding.
      // (Gating still exists, but this makes the first experience deterministic.)
      if (!isAllowedWhileLockedRoute(pathname)) {
        if (pathname === "/") {
          router.replace("/onboarding");
        } else {
          router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
        }
      }
    });
  }, [workspaces, requestedDefault, getOrCreate, pathname, router]);

  // Auto-select workspace
  useEffect(() => {
    if (!workspaces || workspaces.length === 0) return;
    const saved = loadSaved();
    const match = workspaces.find((w) => w._id === saved);
    if (match) {
      setActiveId(match._id);
    } else {
      setActiveId(workspaces[0]._id);
      persist(workspaces[0]._id);
    }
  }, [workspaces]);

  const switchWorkspace = useCallback((id: Id<"workspaces">) => {
    setActiveId(id);
    persist(id);
  }, []);

  const value = useMemo<WorkspaceContext | null>(() => {
    if (!workspaces || workspaces.length === 0 || !activeId) return null;

    const ws = workspaces.find((w) => w._id === activeId) ?? workspaces[0];
    const role = ws.role as WorkspaceRole;

    const hierarchy: Record<WorkspaceRole, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    return {
      workspaceId: ws._id as Id<"workspaces">,
      membershipId: ws.membershipId as Id<"workspaceMembers">,
      workspace: ws as typeof ws & { membershipId: Id<"workspaceMembers"> },
      role,
      workspaces,
      switchWorkspace,
      isLoading: false,
      canEdit: hierarchy[role] >= 2,
      canManage: hierarchy[role] >= 3,
      canAdmin: hierarchy[role] >= 4,
    };
  }, [workspaces, activeId, switchWorkspace]);

  // Loading state
  if (workspaces === undefined || !value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-orange border-t-transparent" />
          <p className="text-sm text-text-muted">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
