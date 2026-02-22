"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FilesystemTree } from "./FilesystemTree";

export function MobileFilesystemDrawer({
  rootPath,
  treeByPath,
  selectedPath,
  expandedDirs,
  loadingDirs,
  onRefreshRoot,
  onToggleDirectory,
  onOpenFile,
}: {
  rootPath: string;
  treeByPath: Record<string, import("./types").FilesystemNode[]>;
  selectedPath: string | null;
  expandedDirs: Set<string>;
  loadingDirs: Set<string>;
  onRefreshRoot: () => void;
  onToggleDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 lg:hidden">
          Browse Files
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-full max-w-[360px] p-0 bg-bg-secondary border-border-default"
      >
        <SheetHeader className="px-4 py-3 border-b border-border-default">
          <SheetTitle className="text-sm text-text-primary">
            Filesystem
          </SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <FilesystemTree
            rootPath={rootPath}
            treeByPath={treeByPath}
            selectedPath={selectedPath}
            expandedDirs={expandedDirs}
            loadingDirs={loadingDirs}
            onRefreshRoot={onRefreshRoot}
            onToggleDirectory={onToggleDirectory}
            onOpenFile={(path) => {
              onOpenFile(path);
              setOpen(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
