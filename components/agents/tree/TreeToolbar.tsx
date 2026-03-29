"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RefreshCw, ChevronRight, ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentStatus = "active" | "idle" | "error" | "offline" | "all";

interface TreeToolbarProps {
  onRefresh: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  filter: AgentStatus;
  onFilterChange: (filter: AgentStatus) => void;
  lastRefresh: number;
}

const filterLabels: Record<AgentStatus, string> = {
  all: "All Agents",
  active: "Active Only",
  idle: "Idle Only",
  error: "Error Only",
  offline: "Offline Only",
};

export function TreeToolbar({
  onRefresh,
  onExpandAll,
  onCollapseAll,
  filter,
  onFilterChange,
  lastRefresh,
}: TreeToolbarProps) {
  const timeSinceRefresh = Math.floor((Date.now() - lastRefresh) / 1000);

  return (
    <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
      <div className="flex items-center gap-2">
        {/* Expand/Collapse All - Hide on mobile */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExpandAll}
            className="gap-1"
          >
            <ChevronDown className="h-4 w-4" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCollapseAll}
            className="gap-1"
          >
            <ChevronRight className="h-4 w-4" />
            Collapse All
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{filterLabels[filter]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {(Object.keys(filterLabels) as AgentStatus[]).map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => onFilterChange(status)}
                className={cn(
                  "flex items-center justify-between gap-2",
                  filter === status && "bg-bg-secondary",
                )}
              >
                {filterLabels[status]}
                {filter === status && (
                  <div className="h-2 w-2 rounded-full bg-status-active" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="gap-2"
        >
          <RefreshCw
            className={cn("h-4 w-4", timeSinceRefresh < 2 && "animate-spin")}
          />
          <span className="hidden sm:inline">
            {timeSinceRefresh < 60 ? `${timeSinceRefresh}s ago` : "Refresh"}
          </span>
        </Button>
      </div>
    </div>
  );
}
