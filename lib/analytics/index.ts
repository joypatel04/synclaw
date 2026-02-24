// lib/analytics/index.ts
// Public API — import everything from '@/lib/analytics'

// Core tracking functions
export {
  identifyUser,
  clearUserIdentity,
  trackPage,
  trackDashboardView,
  trackSectionVisit,
  trackTaskView,
  trackTaskCreate,
  trackTaskEdit,
  trackTaskDelete,
  trackTaskComplete,
  trackTaskSearch,
  trackTaskFilter,
  trackChatView,
  trackMessageSend,
  trackNewChat,
  trackChatSearch,
  trackFilesView,
  trackFileUpload,
  trackFileDownload,
  trackFileDelete,
  trackFileSearch,
  trackBroadcastView,
  trackBroadcastCreate,
  trackBroadcastSend,
  trackDocsView,
  trackDocView,
  trackDocSearch,
  trackScrollDepth,
  trackCopyLink,
  trackApiRequest,
  trackCommandRun,
  trackCommandSuccess,
  trackCommandFailure,
  trackSupportRequest,
  trackFeedbackSubmit,
} from './track';

// Hooks
export { useUmamiPageview } from './useUmamiPageview';
export { useUmamiIdentify } from './useUmamiIdentify';
export { useScrollDepth } from './useScrollDepth';

// Attribution
export {
  pathToSection,
  setLastSection,
  getLastSection,
  getAttributionContext,
} from './attribution';
export type { SectionType } from './attribution';

// Event constants
export {
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

// Guards (useful for conditional rendering of debug UI)
export { isTrackingEnabled, isDebugMode, debugLog } from './guards';
