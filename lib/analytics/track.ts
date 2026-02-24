// lib/analytics/track.ts
// Global analytics API — all Umami calls go through here.
// Developers should NEVER call window.umami directly.

import { isTrackingEnabled, debugLog } from './guards';
import { getAttributionContext, type SectionType } from './attribution';
import {
  NAV_EVENTS,
  DASHBOARD_EVENTS,
  TASK_EVENTS,
  CHAT_EVENTS,
  FILE_EVENTS,
  BROADCAST_EVENTS,
  DOCS_EVENTS,
  ENGAGEMENT_EVENTS,
  API_EVENTS,
  CONTACT_EVENTS,
} from './events';

// ─── Umami type declaration ─────────────────────────────────────
declare global {
  interface Window {
    umami?: {
      track: {
        (eventName: string, eventData?: Record<string, unknown>): void;
        (): void; // pageview overload
      };
      identify: (data: Record<string, unknown>) => void;
    };
  }
}

// ─── Dedup layer ────────────────────────────────────────────────
// Suppresses identical events fired within a short window.
// This prevents double-fires from React Strict Mode (dev) and
// re-renders that re-run effects with the same arguments.

const DEDUP_WINDOW_MS = 200;
const recentEvents = new Map<string, number>();

function isDuplicate(eventName: string, data?: Record<string, unknown>): boolean {
  // Build a fingerprint from event name + serialized data
  const key = `${eventName}::${JSON.stringify(data ?? {})}`;
  const now = Date.now();
  const lastFired = recentEvents.get(key);

  if (lastFired && now - lastFired < DEDUP_WINDOW_MS) {
    return true;
  }

  recentEvents.set(key, now);

  // Housekeeping: prune stale entries every 50 inserts to avoid memory leak
  if (recentEvents.size > 100) {
    for (const [k, ts] of recentEvents) {
      if (now - ts > DEDUP_WINDOW_MS * 5) recentEvents.delete(k);
    }
  }

  return false;
}

// ─── Internal send helper ───────────────────────────────────────

function send(eventName: string, data?: Record<string, unknown>): void {
  try {
    // Dedup: skip if this exact event was already fired within the window
    if (isDuplicate(eventName, data)) {
      debugLog(`[DEDUP] ${eventName} (suppressed)`, data);
      return;
    }

    // Always debug-log first (even if tracking is disabled)
    debugLog(eventName, data);

    if (!isTrackingEnabled()) return;
    if (!window.umami) return;

    window.umami.track(eventName, data ?? {});
  } catch {
    // Fail silently — analytics must never break the app
  }
}

// ─── USER IDENTIFICATION ────────────────────────────────────────

/**
 * Identify the current user to Umami.
 * Once called, all subsequent events in this session are associated
 * with this user in the Umami dashboard.
 *
 * We only send non-sensitive properties useful for segmentation:
 *   - user_id (internal ID)
 *   - role (if available)
 *   - subscription_tier (if available)
 *
 * Email / personal data are NOT sent to keep analytics privacy-safe.
 */
export function identifyUser(props: {
  userId: string;
  email?: string;
  role?: string;
  subscriptionTier?: string;
}): void {
  try {
    const data: Record<string, unknown> = {
      user_id: props.userId,
      email: props.email ?? '',
      role: props.role ?? 'unknown',
      subscription_tier: props.subscriptionTier ?? '',
    };

    debugLog('identify_user', data);

    if (!isTrackingEnabled()) return;
    if (!window.umami?.identify) return;

    window.umami.identify(data);
  } catch {
    // Fail silently
  }
}

/** Clear user identity (call on logout) */
export function clearUserIdentity(): void {
  try {
    debugLog('clear_user_identity');

    if (!isTrackingEnabled()) return;
    if (!window.umami?.identify) return;

    // Reset to anonymous by sending empty identify
    window.umami.identify({ user_id: '', email: '', role: '', subscription_tier: '' });
  } catch {
    // Fail silently
  }
}

// ─── PUBLIC API ─────────────────────────────────────────────────

/** Track a pageview (call on SPA route change) */
export function trackPage(
  type: string,
  meta?: Record<string, unknown>
): void {
  send(NAV_EVENTS.PAGE_VIEW, {
    page_type: type,
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    ...meta,
  });
}

// ─── Dashboard events ──────────────────────────────────────

export function trackDashboardView(section?: string) {
  send(DASHBOARD_EVENTS.DASHBOARD_VISIT, {
    section,
  });
}

export function trackSectionVisit(section: SectionType) {
  const eventMap: Record<SectionType, string> = {
    dashboard: DASHBOARD_EVENTS.ACTIVITY_VISIT,
    tasks: DASHBOARD_EVENTS.TASKS_VISIT,
    chat: DASHBOARD_EVENTS.CHAT_VISIT,
    files: DASHBOARD_EVENTS.FILES_VISIT,
    broadcasts: DASHBOARD_EVENTS.BROADCAST_VISIT,
    docs: DASHBOARD_EVENTS.DOCS_VISIT,
  };

  send(eventMap[section], {
    section,
    ...getAttributionContext(),
  });
}

// ─── Task events ─────────────────────────────────────────────

export function trackTaskView(taskId: string) {
  send(TASK_EVENTS.TASK_VIEW, {
    task_id: taskId,
    ...getAttributionContext(),
  });
}

export function trackTaskCreate(taskId: string) {
  send(TASK_EVENTS.TASK_CREATE, {
    task_id: taskId,
    ...getAttributionContext(),
  });
}

export function trackTaskEdit(taskId: string) {
  send(TASK_EVENTS.TASK_EDIT, {
    task_id: taskId,
    ...getAttributionContext(),
  });
}

export function trackTaskDelete(taskId: string) {
  send(TASK_EVENTS.TASK_DELETE, {
    task_id: taskId,
    ...getAttributionContext(),
  });
}

export function trackTaskComplete(taskId: string) {
  send(TASK_EVENTS.TASK_COMPLETE, {
    task_id: taskId,
    ...getAttributionContext(),
  });
}

export function trackTaskSearch(query: string) {
  send(TASK_EVENTS.TASK_SEARCH, {
    query,
  });
}

export function trackTaskFilter(filterName: string, filterValue: string) {
  send(TASK_EVENTS.TASK_FILTER_APPLIED, {
    filter_name: filterName,
    filter_value: filterValue,
  });
}

// ─── Chat events ─────────────────────────────────────────────

export function trackChatView(chatId: string) {
  send(CHAT_EVENTS.CHAT_VIEW, {
    chat_id: chatId,
    ...getAttributionContext(),
  });
}

export function trackMessageSend(chatId: string, messageId: string) {
  send(CHAT_EVENTS.MESSAGE_SEND, {
    chat_id: chatId,
    message_id: messageId,
    ...getAttributionContext(),
  });
}

export function trackNewChat(chatId: string) {
  send(CHAT_EVENTS.NEW_CHAT_CREATE, {
    chat_id: chatId,
    ...getAttributionContext(),
  });
}

export function trackChatSearch(query: string) {
  send(CHAT_EVENTS.CHAT_SEARCH, {
    query,
  });
}

// ─── File events ─────────────────────────────────────────────

export function trackFilesView() {
  send(FILE_EVENTS.FILES_VIEW, {
    ...getAttributionContext(),
  });
}

export function trackFileUpload(fileId: string, fileName: string, fileType: string) {
  send(FILE_EVENTS.FILE_UPLOAD, {
    file_id: fileId,
    file_name: fileName,
    file_type: fileType,
    ...getAttributionContext(),
  });
}

export function trackFileDownload(fileId: string, fileName: string) {
  send(FILE_EVENTS.FILE_DOWNLOAD, {
    file_id: fileId,
    file_name: fileName,
    ...getAttributionContext(),
  });
}

export function trackFileDelete(fileId: string) {
  send(FILE_EVENTS.FILE_DELETE, {
    file_id: fileId,
    ...getAttributionContext(),
  });
}

export function trackFileSearch(query: string) {
  send(FILE_EVENTS.FILES_SEARCH, {
    query,
  });
}

// ─── Broadcast events ─────────────────────────────────────────

export function trackBroadcastView(broadcastId: string) {
  send(BROADCAST_EVENTS.BROADCAST_VIEW, {
    broadcast_id: broadcastId,
    ...getAttributionContext(),
  });
}

export function trackBroadcastCreate(broadcastId: string) {
  send(BROADCAST_EVENTS.BROADCAST_CREATE, {
    broadcast_id: broadcastId,
    ...getAttributionContext(),
  });
}

export function trackBroadcastSend(broadcastId: string, target: string) {
  send(BROADCAST_EVENTS.BROADCAST_SEND, {
    broadcast_id: broadcastId,
    target,
    ...getAttributionContext(),
  });
}

// ─── Documentation events ─────────────────────────────────────

export function trackDocsView() {
  send(DOCS_EVENTS.DOCS_VIEW, {
    ...getAttributionContext(),
  });
}

export function trackDocView(docPath: string) {
  send(DOCS_EVENTS.DOC_VIEW, {
    doc_path: docPath,
    ...getAttributionContext(),
  });
}

export function trackDocSearch(query: string) {
  send(DOCS_EVENTS.DOC_SEARCH, {
    query,
  });
}

// ─── Engagement events ─────────────────────────────────────────

export function trackScrollDepth(depth: number) {
  send(ENGAGEMENT_EVENTS.SCROLL_DEPTH, {
    depth,
  });
}

export function trackCopyLink(url: string) {
  send(ENGAGEMENT_EVENTS.COPY_LINK, {
    url,
  });
}

// ─── API events ───────────────────────────────────────────────

export function trackApiRequest(endpoint: string, method: string) {
  send(API_EVENTS.API_REQUEST, {
    endpoint,
    method,
  });
}

export function trackCommandRun(command: string) {
  send(API_EVENTS.COMMAND_RUN, {
    command,
  });
}

export function trackCommandSuccess(command: string, duration: number) {
  send(API_EVENTS.COMMAND_SUCCESS, {
    command,
    duration_ms: duration,
  });
}

export function trackCommandFailure(command: string, error: string) {
  send(API_EVENTS.COMMAND_FAILURE, {
    command,
    error,
  });
}

// ─── Contact/Support events ───────────────────────────────────

export function trackSupportRequest(category: string) {
  send(CONTACT_EVENTS.SUPPORT_REQUEST, {
    category,
  });
}

export function trackFeedbackSubmit(type: string) {
  send(CONTACT_EVENTS.FEEDBACK_SUBMIT, {
    feedback_type: type,
  });
}
