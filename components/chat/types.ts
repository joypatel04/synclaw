export type UiChatMessage = {
  id: string;
  fromUser: boolean;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: number;
  localSeq?: number;
  state?:
    | "queued"
    | "sending"
    | "streaming"
    | "completed"
    | "failed"
    | "aborted";
  errorMessage?: string;
  externalMessageId?: string;
  externalRunId?: string;
};

export type UpsertPartial = Omit<UiChatMessage, "id"> & {
  id?: string;
  append?: boolean;
};

export type MessageGroup = {
  id: string;
  role: UiChatMessage["role"];
  fromUser: boolean;
  messages: UiChatMessage[];
};
