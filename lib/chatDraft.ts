const DRAFT_PREFIX = "synclaw-hq:chat-draft";

function draftKey(args: { workspaceId: string; sessionKey: string }) {
  return `${DRAFT_PREFIX}:${args.workspaceId}:${args.sessionKey}`;
}

export function setChatDraft(args: {
  workspaceId: string;
  sessionKey: string;
  content: string;
}) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(draftKey(args), args.content);
  } catch {
    // Ignore storage failures (private mode / quota). Drafting is best-effort.
  }
}

export function getChatDraft(args: {
  workspaceId: string;
  sessionKey: string;
}): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(draftKey(args));
  } catch {
    return null;
  }
}

export function consumeChatDraft(args: {
  workspaceId: string;
  sessionKey: string;
}): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = draftKey(args);
    const value = window.sessionStorage.getItem(key);
    if (value !== null) {
      window.sessionStorage.removeItem(key);
    }
    return value;
  } catch {
    return null;
  }
}
