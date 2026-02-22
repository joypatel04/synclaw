"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { FilesystemNode } from "./types";
import { FilesystemTree } from "./FilesystemTree";

export function MobileFilesystemDrawer({
  items,
  currentPath,
  selectedPath,
  loading,
  onOpenDirectory,
  onOpenFile,
}: {
  items: FilesystemNode[];
  currentPath: string;
  selectedPath: string | null;
  loading?: boolean;
  onOpenDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 lg:hidden">
          Browse Files
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[320px] p-0 bg-bg-secondary border-border-default">
        <SheetHeader className="px-4 py-3 border-b border-border-default">
          <SheetTitle className="text-sm text-text-primary">Filesystem</SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <FilesystemTree
            items={items}
            currentPath={currentPath}
            selectedPath={selectedPath}
            loading={loading}
            onOpenDirectory={onOpenDirectory}
            onOpenFile={onOpenFile}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

