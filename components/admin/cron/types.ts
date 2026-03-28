export type CronScheduleType = "cron" | "every" | "at";
export type CronJobStatus = "enabled" | "disabled";
export type CronRunStatus = "success" | "failed" | "running" | "never";
export type SessionTarget = "main" | "isolated" | "current" | `session:${string}`;
export type DeliveryMode = "none" | "announce" | "webhook";
export type PayloadKind = "systemEvent" | "agentTurn";

export interface CronSchedule {
  kind: CronScheduleType;
  at?: string; // ISO timestamp for "at" type
  everyMs?: number; // Interval in milliseconds for "every" type
  expr?: string; // Cron expression for "cron" type
  tz?: string; // Timezone for cron type
}

export interface CronPayload {
  kind: PayloadKind;
  text?: string; // For systemEvent
  message?: string; // For agentTurn
  model?: string; // For agentTurn
  thinking?: string; // For agentTurn
  timeoutSeconds?: number; // For agentTurn
}

export interface CronDelivery {
  mode: DeliveryMode;
  channel?: string; // For announce mode
  to?: string; // For announce mode
  bestEffort?: boolean;
}

export interface CronJob {
  id: string;
  name?: string;
  schedule: CronSchedule;
  payload: CronPayload;
  delivery?: CronDelivery;
  sessionTarget?: SessionTarget;
  enabled: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface CronRun {
  id: string;
  jobId: string;
  startedAt: number;
  duration?: number;
  status: CronRunStatus;
  error?: string;
  output?: string;
}
