"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ActionTemplate =
  | "create_task"
  | "create_document"
  | "log_activity"
  | "task_and_nudge_main";

export function WebhookCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (args: {
    name: string;
    description?: string;
    enabled: boolean;
    eventFilter: string[];
    actionTemplate: ActionTemplate;
    mappingConfig: {
      titlePath?: string;
      bodyPath?: string;
      priority?: "high" | "medium" | "low" | "none";
      status?: "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked";
    };
  }) => Promise<void>;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventFilterCsv, setEventFilterCsv] = useState("*");
  const [actionTemplate, setActionTemplate] =
    useState<ActionTemplate>("create_task");
  const [titlePath, setTitlePath] = useState("event.type");
  const [bodyPath, setBodyPath] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low" | "none">(
    "medium",
  );
  const [status, setStatus] = useState<
    "inbox" | "assigned" | "in_progress" | "review" | "done" | "blocked"
  >("inbox");

  const submit = async () => {
    if (!name.trim()) return;
    const eventFilter = eventFilterCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      enabled: true,
      eventFilter: eventFilter.length > 0 ? eventFilter : ["*"],
      actionTemplate,
      mappingConfig: {
        titlePath: titlePath.trim() || undefined,
        bodyPath: bodyPath.trim() || undefined,
        priority,
        status,
      },
    });
    setName("");
    setDescription("");
    setEventFilterCsv("*");
    setActionTemplate("create_task");
    setTitlePath("event.type");
    setBodyPath("");
    setPriority("medium");
    setStatus("inbox");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-bg-secondary border-border-default text-text-primary">
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="GitHub Issues Intake"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Inbound issues from GitHub to task queue"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Action</Label>
              <Select
                value={actionTemplate}
                onValueChange={(v) => setActionTemplate(v as ActionTemplate)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default text-text-primary">
                  <SelectItem value="create_task">Create Task</SelectItem>
                  <SelectItem value="create_document">Create Document</SelectItem>
                  <SelectItem value="log_activity">Log Activity</SelectItem>
                  <SelectItem value="task_and_nudge_main">
                    Task + Nudge Main
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Event Filter</Label>
              <Input
                value={eventFilterCsv}
                onChange={(e) => setEventFilterCsv(e.target.value)}
                placeholder="*, issue.created"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title Path</Label>
              <Input
                value={titlePath}
                onChange={(e) => setTitlePath(e.target.value)}
                placeholder="event.type"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body Path</Label>
              <Input
                value={bodyPath}
                onChange={(e) => setBodyPath(e.target.value)}
                placeholder="payload.message"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) =>
                  setPriority(v as "high" | "medium" | "low" | "none")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default text-text-primary">
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Status</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setStatus(
                    v as
                      | "inbox"
                      | "assigned"
                      | "in_progress"
                      | "review"
                      | "done"
                      | "blocked",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-bg-tertiary border-border-default text-text-primary">
                  <SelectItem value="inbox">Inbox</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            className="text-text-secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-accent-orange hover:bg-accent-orange/90 text-white"
            disabled={isSaving || !name.trim()}
            onClick={() => void submit()}
          >
            {isSaving ? "Creating..." : "Create Webhook"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

