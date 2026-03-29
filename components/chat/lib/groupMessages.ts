import type { MessageGroup, UiChatMessage } from "../types";

const TWO_MINUTES = 2 * 60_000;

/**
 * Group consecutive messages by author.
 * A new group starts when: role changes, fromUser changes, or time gap > 2 min.
 */
export function groupMessages(messages: UiChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let current: MessageGroup | null = null;

  for (const msg of messages) {
    const shouldBreak =
      !current ||
      current.role !== msg.role ||
      current.fromUser !== msg.fromUser ||
      (current.messages.length > 0 &&
        Math.abs(
          msg.createdAt -
            current.messages[current.messages.length - 1].createdAt,
        ) > TWO_MINUTES);

    if (shouldBreak) {
      current = {
        id: msg.id,
        role: msg.role,
        fromUser: msg.fromUser,
        messages: [msg],
      };
      groups.push(current);
    } else {
      current?.messages.push(msg);
    }
  }

  return groups;
}
