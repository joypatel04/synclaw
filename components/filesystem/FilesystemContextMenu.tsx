"use client";

import { useEffect } from "react";

export function FilesystemContextMenu({
  open,
  x,
  y,
  path,
  canDelete,
  deleting,
  onDelete,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  path: string | null;
  canDelete: boolean;
  deleting: boolean;
  onDelete: (path: string) => Promise<void>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onClick = () => onClose();
    window.addEventListener("keydown", onEsc);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onEsc);
      window.removeEventListener("click", onClick);
    };
  }, [open, onClose]);

  if (!open || !path) return null;

  return (
    <div
      className="fixed z-50 w-52 rounded-lg border border-border-default bg-bg-secondary p-1 shadow-xl"
      style={{ left: x, top: y }}
    >
      <button
        type="button"
        className="w-full rounded-md px-3 py-2 text-left text-xs text-text-primary hover:bg-bg-tertiary"
        onClick={async () => {
          await navigator.clipboard.writeText(path);
          onClose();
        }}
      >
        Copy path
      </button>
      {canDelete ? (
        <button
          type="button"
          className="w-full rounded-md px-3 py-2 text-left text-xs text-status-blocked hover:bg-bg-tertiary disabled:opacity-60"
          disabled={deleting}
          onClick={() => {
            void onDelete(path);
          }}
        >
          {deleting ? "Deleting..." : "Delete file"}
        </button>
      ) : null}
    </div>
  );
}
