"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useRef, useState } from "react";

interface CommentFormProps { taskId: Id<"tasks">; }

export function CommentForm({ taskId }: CommentFormProps) {
  const { workspaceId, canEdit } = useWorkspace();
  const createMessage = useMutation(api.messages.create);
  const agents = useQuery(api.agents.list, { workspaceId }) ?? [];
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!canEdit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      await createMessage({ workspaceId, taskId, agentId: null, content: content.trim() });
      setContent("");
    } catch (error) {
      console.error("Failed to post comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentions(true); setMentionFilter("");
    } else if (lastAtIndex !== -1) {
      const afterAt = value.substring(lastAtIndex + 1);
      if (!afterAt.includes(" ")) { setShowMentions(true); setMentionFilter(afterAt.toLowerCase()); }
      else setShowMentions(false);
    } else setShowMentions(false);
  };

  const insertMention = (name: string) => {
    const lastAtIndex = content.lastIndexOf("@");
    setContent(`${content.substring(0, lastAtIndex)}@${name} `);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const filteredAgents = agents.filter((a) => a.name.toLowerCase().includes(mentionFilter));

  return (
    <form onSubmit={handleSubmit} className="relative">
      {showMentions && filteredAgents.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-full rounded-lg border border-border-default bg-bg-tertiary p-1 shadow-lg z-10">
          {filteredAgents.map((agent) => (
            <button key={agent._id} type="button" onClick={() => insertMention(agent.name)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-smooth">
              <span>{agent.emoji}</span><span className="font-medium">{agent.name}</span><span className="text-text-muted text-xs">{agent.role}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Textarea ref={textareaRef} value={content} onChange={handleChange} placeholder="Add a comment... (type @ to mention)" rows={2} className="flex-1 bg-bg-primary border-border-default text-text-primary placeholder:text-text-dim focus-visible:ring-accent-orange resize-none text-sm" />
        <Button type="submit" size="icon" disabled={!content.trim() || isSubmitting} className="shrink-0 bg-accent-orange hover:bg-accent-orange/90 text-white h-auto"><Send className="h-4 w-4" /></Button>
      </div>
    </form>
  );
}
