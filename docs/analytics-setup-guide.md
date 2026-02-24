# Synclaw Analytics Setup Guide

This guide explains how to set up and use the Umami analytics integration in Synclaw.

## Overview

Synclaw uses Umami for privacy-focused analytics. The implementation includes:

- **Automatic pageview tracking** - Tracks all page navigations in the SPA
- **User identification** - Associates events with authenticated users
- **Custom event tracking** - Pre-defined events for key user actions
- **Attribution tracking** - Tracks which section users came from
- **Scroll depth tracking** - Measures page engagement

## Setup

### 1. Configure Umami Website ID

Add your Umami website ID to your environment variables:

```bash
# .env.local
NEXT_PUBLIC_UMAMI_WEBSITE_ID=f7ff4521-6a76-4885-9932-44c7802db117
```

The Umami script is already integrated in `app/layout.tsx` via the `<UmamiAnalytics />` component.

### 2. (Optional) Enable Debug Mode

To see analytics events in the console during development:

```bash
# .env.local
NEXT_PUBLIC_ANALYTICS_DEBUG=true
```

### 3. Verify Integration

Start your development server and open the browser console with debug mode enabled:

```bash
bun run dev
```

You should see log messages like:
```
[Umami Debug] page_view { page_type: 'dashboard', url: '/', ... }
```

## Usage

### Basic Page Tracking

Page tracking is automatic. No additional code needed for basic pageviews.

### Custom Event Tracking

Import tracking functions from `@/lib/analytics`:

```tsx
import { trackTaskCreate } from '@/lib/analytics';

function CreateTaskButton() {
  const handleClick = () => {
    // ... create task logic
    trackTaskCreate(newTaskId);
  };

  return <button onClick={handleClick}>Create Task</button>;
}
```

### Using Hooks

#### useScrollDepth

Track scroll depth on any page:

```tsx
import { useScrollDepth } from '@/lib/analytics';

function TaskDetailPage({ taskId }) {
  useScrollDepth('task-detail');

  return <div>Task content...</div>;
}
```

#### useUmamiIdentify

User identification is handled automatically by the `<UmamiAnalytics />` component. No need to use this hook directly.

## Available Tracking Functions

### Navigation
- `trackPage(type, meta)` - Track a pageview
- `trackCopyLink(url)` - Track link copying

### Dashboard
- `trackDashboardView(section)` - Track dashboard visits
- `trackSectionVisit(section)` - Track section visits (tasks, chat, etc.)

### Tasks
- `trackTaskView(taskId)` - Track task detail view
- `trackTaskCreate(taskId)` - Track task creation
- `trackTaskEdit(taskId)` - Track task editing
- `trackTaskDelete(taskId)` - Track task deletion
- `trackTaskComplete(taskId)` - Track task completion
- `trackTaskSearch(query)` - Track task search
- `trackTaskFilter(filterName, filterValue)` - Track filter application

### Chat
- `trackChatView(chatId)` - Track chat view
- `trackMessageSend(chatId, messageId)` - Track message sending
- `trackNewChat(chatId)` - Track new chat creation
- `trackChatSearch(query)` - Track chat search

### Files
- `trackFilesView()` - Track files dashboard view
- `trackFileUpload(fileId, fileName, fileType)` - Track file upload
- `trackFileDownload(fileId, fileName)` - Track file download
- `trackFileDelete(fileId)` - Track file deletion
- `trackFileSearch(query)` - Track file search

### Broadcasts
- `trackBroadcastView(broadcastId)` - Track broadcast view
- `trackBroadcastCreate(broadcastId)` - Track broadcast creation
- `trackBroadcastSend(broadcastId, target)` - Track broadcast sending

### Documentation
- `trackDocsView()` - Track docs section view
- `trackDocView(docPath)` - Track specific doc view
- `trackDocSearch(query)` - Track doc search

### API/Commands
- `trackApiRequest(endpoint, method)` - Track API requests
- `trackCommandRun(command)` - Track command execution
- `trackCommandSuccess(command, duration)` - Track successful command
- `trackCommandFailure(command, error)` - Track failed command

### Support
- `trackSupportRequest(category)` - Track support requests
- `trackFeedbackSubmit(type)` - Track feedback submissions

## Event Schema

### Page Type Classification

| Path | Page Type |
|------|-----------|
| `/` or `/dashboard` | `dashboard` |
| `/tasks` | `tasks-listing` |
| `/tasks/[id]` | `task-detail` |
| `/chat` | `chat-listing` |
| `/chat/[id]` | `chat-detail` |
| `/filesystem` | `files-dashboard` |
| `/broadcasts` | `broadcasts-listing` |
| `/docs/*` | `docs-page` |
| `/v3` | `v3-dashboard` |

### Attribution Sections

- `dashboard`
- `tasks`
- `chat`
- `files`
- `broadcasts`
- `docs`

## Best Practices

1. **Track Key Actions**: Focus on tracking actions that provide business value (task creation, message sending, etc.)

2. **Consistent Naming**: Use the provided tracking functions instead of calling `window.umami` directly

3. **Privacy-First**: No PII is sent to analytics. User identification uses internal IDs only

4. **Test in Debug Mode**: Always test your event tracking with `NEXT_PUBLIC_ANALYTICS_DEBUG=true` first

5. **Don't Over-Track**: Avoid tracking every single interaction. Focus on meaningful user journeys

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Your Umami website ID | Yes |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | Enable console logging (true/false) | No |

## Debugging

### Check if Tracking is Working

1. Enable debug mode: `NEXT_PUBLIC_ANALYTICS_DEBUG=true`
2. Open browser console
3. Navigate through the app
4. Look for `[Umami Debug]` log messages

### Common Issues

**Events not appearing in Umami dashboard:**
- Check that `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set correctly
- Verify you're in production or have debug mode enabled
- Check that Umami is accessible from your domain

**Duplicate events in console:**
- This is normal in development due to React Strict Mode
- Dedup logic prevents duplicate events from being sent to Umami

**Bot filtering:**
- Analytics automatically filters out bots
- Check `lib/analytics/guards.ts` for the bot detection list

## Architecture

```
components/
  analytics/
    UmamiAnalytics.tsx          # Main component (loads script, hooks)
lib/
  analytics/
    index.ts                   # Public API exports
    track.ts                   # All tracking functions
    events.ts                  # Event constants
    guards.ts                  # Environment/bot guards
    attribution.ts             # Cross-section attribution
    useUmamiPageview.ts        # SPA pageview tracking
    useUmamiIdentify.ts        # User identification (Convex)
    useScrollDepth.ts          # Scroll depth hook
```

## Support

For questions or issues with the analytics implementation, refer to:
- [Umami Documentation](https://umami.is/docs)
- Convex Auth integration in `convex/auth.ts`
- Analytics guard logic in `lib/analytics/guards.ts`
