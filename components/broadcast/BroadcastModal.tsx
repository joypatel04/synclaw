"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface BroadcastModalProps { open: boolean; onOpenChange: (open: boolean) => void; }

export function BroadcastModal({ open, onOpenChange }: BroadcastModalProps) {
  const { workspaceId } = useWorkspace();
  const createBroadcast = useMutation(api.broadcasts.create);
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsSubmitting(true);
    try {
      await createBroadcast({ workspaceId, title: title.trim(), content: content.trim(), targetAgentIds: sendToAll ? "all" : (selectedAgents as Id<"agents">[]) });
      setTitle(""); setContent(""); setSendToAll(true); setSelectedAgents([]);
      onOpenChange(false);
    } catch (error) { console.error("Failed:", error); }
    finally { setIsSubmitting(false); }
  };

  const toggleAgent = (id: string) => setSelectedAgents((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-bg-secondary border-border-default sm:max-w-[500px]">
        <DialogHeader><DialogTitle className="text-text-primary">New Broadcast</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label className="text-text-secondary">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Broadcast title..." className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim" required /></div>
          <div className="space-y-2"><Label className="text-text-secondary">Message</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Broadcast message..." rows={4} className="bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim resize-none" required /></div>
          <div className="space-y-3">
            <Label className="text-text-secondary">Target</Label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={sendToAll} onChange={(e) => { setSendToAll(e.target.checked); if (e.target.checked) setSelectedAgents([]); }} className="rounded border-border-default accent-accent-orange" /><span className="text-sm text-text-primary">Send to All Agents</span></label>
            {!sendToAll && <div className="flex flex-wrap gap-2">{agents.map((a) => (<button key={a._id} type="button" onClick={() => toggleAgent(a._id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-smooth border ${selectedAgents.includes(a._id) ? "bg-bg-hover border-border-hover text-text-secondary" : "bg-bg-primary border-border-default text-text-secondary hover:border-border-hover"}`}><span>{a.emoji}</span>{a.name}</button>))}</div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border-default text-text-secondary">Cancel</Button>
            <Button type="submit" disabled={!title.trim() || !content.trim() || isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">{isSubmitting ? "Sending..." : "Send Broadcast"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
