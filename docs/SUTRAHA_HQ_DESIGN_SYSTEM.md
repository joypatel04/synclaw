# Sutraha HQ Design System

**Based on Crabwalk UI Style**

---

## Typography

### Font Families

```css
font-family: 'Inter', sans-serif;           /* Main UI text */
font-family: 'JetBrains Mono', monospace;   /* Code, logs, timestamps */
```

### Font Weights

| Weight | Usage |
|--------|-------|
| 400 (Regular) | Body text, descriptions |
| 500 (Medium) | Headings, labels |
| 600 (SemiBold) | Card titles, emphasis |
| 700 (Bold) | Major headings |

### Font Sizes

| Size | Usage | px |
|------|-------|-----|
| `text-xs` | Timestamps, badges | 12px |
| `text-sm` | Secondary text | 14px |
| `text-base` | Body text | 16px |
| `text-lg` | Card titles | 18px |
| `text-xl` | Page headings | 20px |
| `text-2xl` | Major headings | 24px |

---

## Color Palette

### Backgrounds

```css
--bg-primary:    #0a0a0f;  /* Main background */
--bg-secondary:  #12121a;  /* Panel backgrounds */
--bg-tertiary:   #1a1a24;  /* Card backgrounds */
--bg-hover:      #22222e;  /* Hover states */
```

### Text

```css
--text-primary:  #e8e8ec;  /* Main text */
--text-secondary: #9ca3af; /* Muted labels */
--text-muted:    #6b7280;  /* Dim text */
--text-dim:      #4b5563;  /* Very dim text */
```

### Accents

```css
--accent:        #f97316;  /* Primary orange */
--accent-dim:    rgba(249, 115, 22, 0.2);
--accent-glow:   rgba(249, 115, 22, 0.1);
```

### Teal (for flow/connections)

```css
--teal:          #14b8a6;
--teal-dim:      rgba(20, 184, 166, 0.2);
```

### Status Colors

```css
--status-active:   #22c55e;  /* Green */
--status-idle:     #6b7280;  /* Gray */
--status-blocked:  #ef4444;  /* Red */
--status-review:   #f59e0b;  /* Amber */
```

### Borders

```css
--border:        #272735;
--border-hover:  #3f3f50;
--border-focus:  #f97316;
```

---

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight spacing |
| `space-2` | 8px | Compact items |
| `space-3` | 12px | Default spacing |
| `space-4` | 16px | Section gaps |
| `space-6` | 24px | Large gaps |
| `space-8` | 32px | Page margins |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Badges, small elements |
| `radius-md` | 8px | Cards, buttons |
| `radius-lg` | 12px | Panels, modals |
| `radius-xl` | 16px | Large containers |

---

## Shadows

```css
--shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.5);
--shadow-md:   0 4px 6px rgba(0, 0, 0, 0.5);
--shadow-lg:   0 10px 15px rgba(0, 0, 0, 0.5);
--shadow-glow: 0 0 20px rgba(249, 115, 22, 0.1);
```

---

## Components

### 1. Button

```css
.btn-primary {
  background: var(--accent);
  color: white;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: #ea580c;
  box-shadow: var(--shadow-glow);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: var(--radius-md);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}
```

### 2. Task Card

```
┌─────────────────────────────┐
│ 📝 SEO Strategy Research   │
│ ─────────────────────────── │
│ High priority               │
│ Assigned: Jarvis, Vision    │
│                             │
│ 🦊 Jarvis: Started keyword   │
│    research...              │
│                             │
│ 2h ago                      │
└─────────────────────────────┘
```

### 3. Agent Card

```
┌──────────────┐
│ 🦊 Jarvis     │
│ ───────────── │
│ ACTIVE       │
│ Working:     │
│ "SEO strategy│
│  research"   │
│              │
│ Heartbeat:   │
│ 2m ago       │
└──────────────┘
```

### 4. Activity Item

```
🦊 Jarvis
Created task "SEO strategy research"
2 minutes ago

[View task →]
```

### 5. Status Badge

```
[ ACTIVE ]    — Green bg, white text
[ BLOCKED ]   — Red bg, white text
[ REVIEW ]    — Amber bg, white text
```

### 6. Kanban Column

```
┌─────────────────┐
│ INBOX          │
│ 11             │
├─────────────────┤
│                 │
│  [Task 1]       │
│  [Task 2]       │
│  ...            │
│                 │
│ [+ Add task]    │
└─────────────────┘
```

### 7. Comment Thread

```
┌─────────────────────────────────────┐
│ Task: SEO Strategy Research         │
├─────────────────────────────────────┤
│                                     │
│ Joy: Let's focus on Mysore keywords │
│                                      │
│ 🔬 Shuri: What about Rishikesh?    │
│              Should we target both?│
│                                      │
│ 🦊 Jarvis: Start with Mysore,     │
│              expand later          │
│                                      │
┌─────────────────────────────────────┐
│ [ Add a comment... ]               │
└─────────────────────────────────────┘
```

---

## Layout Patterns

### Dashboard Grid

```
Grid: 12 columns
- Agent Panel: 3 cols (25%)
- Kanban Board: 6 cols (50%)
- Activity Feed: 3 cols (25%)

Breakpoints:
- Desktop (>1280px): All 3 panels
- Tablet (768px-1280px): Agent + Feed collapsible
- Mobile (<768px): Stacked panels
```

### Card Spacing

```
- Card padding: 16px (space-4)
- Gap between cards: 12px (space-3)
- Gap between sections: 24px (space-6)
```

---

## Animation Timing

```css
--duration-fast:  150ms;
--duration-normal: 250ms;
--duration-slow:  500ms;

--easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);
```

**Use cases:**
- Fast: Hover states, button clicks
- Normal: Modal open/close, page transitions
- Slow: Complex animations (if any)

---

## Icon Usage

| Icon | Usage |
|------|-------|
| `activity` | Activity feed icon |
| `bell` | Notifications |
| `broadcast` | Broadcast messages |
| `check-circle` | Task done |
| `clock` | Timestamps |
| `file-text` | Documents |
| `globe` | External links |
| `more-horizontal` | Overflow menu |
| `plus` | Create task/broadcast |
| `search` | Search |
| `send` | Post comment |
| `settings` | Settings page |
| `users` | Team view |
| `x-circle` | Blocked/error |

---

## Cursor Prompt Design Additions

Add this to the build prompt for UI styling:

```
## UI Styling Requirements

### 1. Dark Theme (Crabwalk-inspired)
- Background: #0a0a0f (deep dark)
- Panels: #12121a
- Cards: #1a1a24
- Primary text: #e8e8ec
- Accent color: #f97316 (orange)
- Use Inter font for main text, JetBrains Mono for timestamps/code

### 2. Card Components
- TaskCard: Title, priority badge, assignees, last activity timestamp
- AgentCard: Name, emoji, status indicator (ACTIVE/IDLE/BLOCKED), current task
- ActivityItem: Author, action, timestamp, optional link to task

### 3. Kanban Board
- 5 columns: Inbox (11), Assigned (10), In Progress (7), Review (5), Done (0)
- Column header shows status + task count
- Task cards are draggable between columns
- Drag visual feedback: card semi-transparent with border

### 4. Status Indicators
- ACTIVE: Green dot + green text
- IDLE: Gray dot + gray text
- BLOCKED: Red dot + red text
- REVIEW: Amber dot + amber text

### 5. Animations
- Smooth transitions (150-250ms)
- Hover: card lifts slightly, background brightens
- Click: instant feedback

### 6. Responsive Design
- Desktop (1280px+): 3-column layout (agents | kanban | feed)
- Tablet (768-1280px): 2-column (kanban full, agents/feed collapsible)
- Mobile (<768px): Stacked single column

### 7. Accessibility
- Minimum contrast ratio 4.5:1 for text
- Focus visible: orange ring
- All interactive elements have hover/active states
```
