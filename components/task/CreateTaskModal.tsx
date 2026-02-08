"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Doc<"agents">[];
}

export function CreateTaskModal({ open, onOpenChange, agents }: CreateTaskModalProps) {
  const { workspaceId } = useWorkspace();
  const createTask = useMutation(api.tasks.create);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low" | "none">("none");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await createTask({
        workspaceId,
        title: title.trim(),
        description: description.trim(),
        status: selectedAgents.length > 0 ? "assigned" : "inbox",
        assigneeIds: selectedAgents as Id<"agents">[],
        priority,
        dueAt: null,
      });
      setTitle(""); setDescription(""); setPriority("none"); setSelectedAgents([]);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAgent = (id: string) =>
    setSelectedAgents((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[500px]">
        <DialogHeader><DialogTitle className="text-text-primary">Create New Task</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-text-secondary">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title..." className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim focus-visible:ring-accent-orange" required />
          </div>
          <div className="space-y-2">
            <Label className="text-text-secondary">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the task..." rows={3} className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim focus-visible:ring-accent-orange resize-none" />
          </div>
          <div className="space-y-2">
            <Label className="text-text-secondary">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger className="bg-bg-primary border-border-default text-text-primary"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-bg-tertiary border-border-default">
                <SelectItem value="high" className="text-status-blocked">High</SelectItem>
                <SelectItem value="medium" className="text-status-review">Medium</SelectItem>
                <SelectItem value="low" className="text-teal">Low</SelectItem>
                <SelectItem value="none" className="text-text-muted">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-text-secondary">Assign to</Label>
            <div className="flex flex-wrap gap-2">
              {agents.map((agent) => (
                <button key={agent._id} type="button" onClick={() => toggleAgent(agent._id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-smooth border ${selectedAgents.includes(agent._id) ? "bg-accent-orange/20 border-accent-orange text-accent-orange" : "bg-bg-primary border-border-default text-text-secondary hover:border-border-hover"}`}>
                  <span>{agent.emoji}</span>{agent.name}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border-default text-text-secondary hover:bg-bg-hover">Cancel</Button>
            <Button type="submit" disabled={!title.trim() || isSubmitting} className="bg-accent-orange hover:bg-accent-orange/90 text-white">{isSubmitting ? "Creating..." : "Create Task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
