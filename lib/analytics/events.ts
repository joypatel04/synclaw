// lib/analytics/events.ts
// Structured event taxonomy for behavioral analytics for synclaw
//
// Intent hierarchy:
//   LOW    → browsing, filtering, scrolling
//   MEDIUM → opening pages, interacting with content
//   HIGH   → actions (create task, send message, run command)
//   COMMERCIAL → subscription, API usage, deployment

// ─── Core navigation events ───────────────────────────────────────
export const NAV_EVENTS = {
  PAGE_VIEW: 'page_view',
  EXTERNAL_CLICK: 'external_click',
} as const;

// ─── Dashboard events ──────────────────────────────────────────────
export const DASHBOARD_EVENTS = {
  DASHBOARD_VISIT: 'dashboard_visit',
  ACTIVITY_VISIT: 'activity_visit',
  TASKS_VISIT: 'tasks_visit',
  CHAT_VISIT: 'chat_visit',
  FILES_VISIT: 'files_visit',
  DOCS_VISIT: 'docs_visit',
} as const;

// ─── Task events ──────────────────────────────────────────────
export const TASK_EVENTS = {
  TASK_VIEW: 'task_view',
  TASK_CREATE: 'task_create',
  TASK_EDIT: 'task_edit',
  TASK_DELETE: 'task_delete',
  TASK_COMPLETE: 'task_complete',
  TASK_COPY: 'task_copy',
  TASK_FILTER_APPLIED: 'task_filter_applied',
  TASK_SEARCH: 'task_search',
} as const;

// ─── Chat events ──────────────────────────────────────────────
export const CHAT_EVENTS = {
  CHAT_VIEW: 'chat_view',
  MESSAGE_SEND: 'message_send',
  MESSAGE_RECEIVE: 'message_receive',
  NEW_CHAT_CREATE: 'chat_create',
  CHAT_FILTER_APPLIED: 'chat_filter_applied',
  CHAT_SEARCH: 'chat_search',
} as const;

// ─── File events ──────────────────────────────────────────────
export const FILE_EVENTS = {
  FILES_VIEW: 'files_view',
  FILE_UPLOAD: 'file_upload',
  FILE_DOWNLOAD: 'file_download',
  FILE_DELETE: 'file_delete',
  FILE_SHARE: 'file_share',
  FILE_PREVIEW: 'file_preview',
  FILES_FILTER_APPLIED: 'files_filter_applied',
  FILES_SEARCH: 'files_search',
} as const;

// ─── Broadcast events ──────────────────────────────────────────────
export const BROADCAST_EVENTS = {
  BROADCAST_VIEW: 'broadcast_view',
  BROADCAST_CREATE: 'broadcast_create',
  BROADCAST_EDIT: 'broadcast_edit',
  BROADCAST_DELETE: 'broadcast_delete',
  BROADCAST_SEND: 'broadcast_send',
} as const;

// ─── Documentation events ──────────────────────────────────────
export const DOCS_EVENTS = {
  DOCS_VIEW: 'docs_view',
  DOC_VIEW: 'doc_view',
  DOC_SEARCH: 'doc_search',
  DOC_NAVIGATION: 'doc_navigation',
} as const;

// ─── Engagement events ──────────────────────────────────────────
export const ENGAGEMENT_EVENTS = {
  SCROLL_DEPTH: 'page_engagement',
  COPY_LINK: 'copy_link',
} as const;

// ─── API/Technical events ───────────────────────────────────────
export const API_EVENTS = {
  API_REQUEST: 'api_request',
  API_ERROR: 'api_error',
  COMMAND_RUN: 'command_run',
  COMMAND_SUCCESS: 'command_success',
  COMMAND_FAILURE: 'command_failure',
} as const;

// ─── Contact/Support events ──────────────────────────────────────
export const CONTACT_EVENTS = {
  SUPPORT_REQUEST: 'support_request',
  FEEDBACK_SUBMIT: 'feedback_submit',
  BUG_REPORT: 'bug_report',
} as const;

// ─── Property types for structured event data ───────────────────
export interface TaskEventProps {
  taskId: string;
  status?: string;
}

export interface ChatEventProps {
  chatId: string;
  messageId?: string;
}

export interface FileEventProps {
  fileId: string;
  fileName?: string;
  fileType?: string;
}

export interface BroadcastEventProps {
  broadcastId: string;
  target?: string;
}
