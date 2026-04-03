"use client";

import { AgentAvatar } from "@/components/shared/AgentAvatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ChatBubble } from "./ChatBubble";
import type { MessageGroup } from "./types";

interface ChatMessageGroupProps {
  group: MessageGroup;
  agentEmoji?: string;
  agentName?: string;
  userName?: string;
  userImage?: string;
}

export function ChatMessageGroup({
  group,
  agentEmoji = "🤖",
  agentName = "Agent",
  userName,
  userImage,
}: ChatMessageGroupProps) {
  const isUser = group.fromUser;

  return (
    <div
      className={cn(
        "flex gap-2 sm:gap-2.5 overflow-hidden",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar — shown once per group */}
      <div className="shrink-0 pt-1">
        {isUser ? (
          <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
            {userImage ? (
              <AvatarImage src={userImage} alt={userName ?? "You"} />
            ) : null}
            <AvatarFallback className="bg-accent-orange/15 text-text-primary border border-accent-orange/25 text-xs">
              {(userName?.trim()?.[0] ?? "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <AgentAvatar emoji={agentEmoji} name={agentName} size="sm" />
        )}
      </div>

      {/* Bubbles — tight vertical spacing within group.
          min-w-0 prevents flex child from overflowing parent on mobile. */}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        {group.messages.map((msg, i) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            agentEmoji={agentEmoji}
            agentName={agentName}
            isGroupStart={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
