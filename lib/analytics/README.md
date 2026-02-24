# Synclaw Analytics Framework

Comprehensive Umami analytics implementation for Synclaw, adapted from the vyana-web analytics framework.

## Features

- ✅ Automatic SPA pageview tracking
- ✅ User identification via Convex Auth
- ✅ Custom event tracking for all key actions
- ✅ Cross-section attribution tracking
- ✅ Scroll depth tracking
- ✅ Bot detection and filtering
- ✅ Environment-aware (dev/prod)
- ✅ Debug mode for development
- ✅ Deduplication to prevent double-fires
- ✅ Privacy-focused (no PII sent)

## Quick Start

```bash
# 1. Set environment variable
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id

# 2. (Optional) Enable debug mode
NEXT_PUBLIC_ANALYTICS_DEBUG=true

# 3. That's it! Analytics are already integrated in app/layout.tsx
```

## Usage Examples

### Track a Custom Event

```tsx
import { trackTaskCreate } from '@/lib/analytics';

function handleCreateTask() {
  const taskId = createTask();
  trackTaskCreate(taskId);
}
```

### Track Page Engagement

```tsx
import { useScrollDepth } from '@/lib/analytics';

function TaskPage() {
  useScrollDepth('task-detail');
  return <div>...</div>;
}
```

## File Structure

```
lib/analytics/
├── index.ts              # Public API (import everything from here)
├── track.ts              # Core tracking functions
├── events.ts             # Event constants and types
├── guards.ts             # Environment guards, bot detection
├── attribution.ts        # Cross-section attribution
├── useUmamiPageview.ts   # SPA pageview tracking hook
├── useUmamiIdentify.ts   # User identification hook (Convex)
└── useScrollDepth.ts     # Scroll depth tracking hook

components/analytics/
└── UmamiAnalytics.tsx    # Main component (add to layout)
```

## Available Events

### Dashboard
- `dashboard_visit`
- `activity_visit`, `tasks_visit`, `chat_visit`, `files_visit`, etc.

### Tasks
- `task_view`, `task_create`, `task_edit`, `task_delete`, `task_complete`
- `task_search`, `task_filter_applied`

### Chat
- `chat_view`, `message_send`, `chat_create`
- `chat_search`

### Files
- `files_view`, `file_upload`, `file_download`, `file_delete`
- `file_search`

### And more...
See `events.ts` for the complete list.

## Attribution

Tracks which section users came from using localStorage with a 30-minute TTL:

```tsx
import { getAttributionContext } from '@/lib/analytics';

// Automatically attached to conversion events
const context = getAttributionContext();
// { attribution_section: 'tasks', referrer_domain: '...' }
```

## Debug Mode

Enable console logging:

```bash
NEXT_PUBLIC_ANALYTICS_DEBUG=true
```

Console output:
```
[Umami Debug] task_create { task_id: 'abc123', ... }
```

## Adapted from vyana-web

This analytics framework was originally developed for vyana-web and adapted for synclaw:

**Key adaptations:**
- ✅ User authentication: Convex Auth instead of next-auth
- ✅ Page types: Tailored for synclaw's dashboard/agents/tasks structure
- ✅ Events: Customized for synclaw's actions (tasks, chat, files, broadcasts)
- ✅ Attribution: Section-based instead of category-based

**Preserved features:**
- ✅ Umami integration (same script URL)
- ✅ Event deduplication logic
- ✅ Bot detection guards
- ✅ Debug mode implementation
- ✅ SPA pageview tracking
- ✅ Scroll depth tracking

## Environment Variables

```bash
# Required
NEXT_PUBLIC_UMAMI_WEBSITE_ID=your-website-id

# Optional (for development)
NEXT_PUBLIC_ANALYTICS_DEBUG=true
```

## Documentation

For detailed setup and usage guide, see: `/docs/analytics-setup-guide.md`
