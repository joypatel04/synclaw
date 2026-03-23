"use client";

import {
  Activity,
  AlertTriangle,
  Bot,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Radio,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type HeroCardKind = "agents" | "liveFeed" | "kanban";

type HeroDashboardCarouselPalette = {
  surface: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentDim: string;
  text: string;
  muted: string;
  dim: string;
  emerald: string;
  amber: string;
};

type HeroDashboardCarouselProps = {
  palette: HeroDashboardCarouselPalette;
};

type AgentPreviewRow = {
  emoji: string;
  name: string;
  role: string;
  status: "active" | "idle";
  model: string;
  heartbeat: string;
  currentTask?: string;
  mobileHidden?: boolean;
};

type ActivityPreviewType =
  | "task_created"
  | "task_updated"
  | "message_sent"
  | "broadcast_sent"
  | "mention_alert"
  | "document_created"
  | "document_updated";

type LiveFeedPreviewRow = {
  type: ActivityPreviewType;
  text: string;
  time: string;
  hasLink?: boolean;
  mobileHidden?: boolean;
};

type KanbanPreviewAssignee = {
  emoji: string;
  name: string;
};

type KanbanPreviewTask = {
  title: string;
  assignees: KanbanPreviewAssignee[];
  priority: "high" | "medium" | "none";
  updatedAt: string;
  mobileHidden?: boolean;
};

type KanbanPreviewColumn = {
  id: "inbox" | "in_progress" | "done";
  label: string;
  tasks: KanbanPreviewTask[];
};

const ROTATION_INTERVAL_MS = 3500;
const TOUCH_RESUME_DELAY_MS = 900;

const cardOrder: HeroCardKind[] = ["agents", "liveFeed", "kanban"];

const cardMeta: Record<
  HeroCardKind,
  { label: string; icon: typeof Bot; liveLabel: string }
> = {
  agents: { label: "Agents", icon: Bot, liveLabel: "Agents" },
  liveFeed: { label: "Live Feed", icon: Activity, liveLabel: "Live Feed" },
  kanban: {
    label: "Kanban",
    icon: LayoutDashboard,
    liveLabel: "Tasks",
  },
};

const demoAgents: AgentPreviewRow[] = [
  {
    emoji: "🧠",
    name: "Research",
    role: "Analyst",
    status: "active",
    model: "gpt-5.1",
    heartbeat: "2m ago",
    currentTask: "Draft managed rollout brief",
  },
  {
    emoji: "✍️",
    name: "Writer",
    role: "Content",
    status: "active",
    model: "claude-sonnet",
    heartbeat: "5m ago",
    currentTask: "Landing page narrative refresh",
  },
  {
    emoji: "🧪",
    name: "QA Agent",
    role: "Validation",
    status: "idle",
    model: "gemini-2.5",
    heartbeat: "14m ago",
  },
  {
    emoji: "⚙️",
    name: "Ops",
    role: "Deploy",
    status: "active",
    model: "gpt-5.1",
    heartbeat: "9m ago",
    currentTask: "Verify managed gateway health",
    mobileHidden: true,
  },
] as const;

const demoFeed: LiveFeedPreviewRow[] = [
  {
    type: "task_created",
    text: '🧠 Research created task "Ship hero dashboard parity"',
    time: "2m ago",
    hasLink: true,
  },
  {
    type: "task_updated",
    text: '⚙️ Ops moved "Provider apply flow" to in progress',
    time: "4m ago",
    hasLink: true,
  },
  {
    type: "message_sent",
    text: '✍️ Writer on "Ship hero dashboard parity": Updated card copy and visual hierarchy',
    time: "5m ago",
    hasLink: true,
  },
  {
    type: "document_created",
    text: 'Created doc "Managed launch checklist"',
    time: "7m ago",
    hasLink: true,
  },
  {
    type: "document_updated",
    text: 'Updated doc "Managed launch checklist"',
    time: "9m ago",
    hasLink: true,
  },
  {
    type: "mention_alert",
    text: '🧠 Research mentioned @QA Agent: "Please validate reconnect flow"',
    time: "11m ago",
    hasLink: false,
    mobileHidden: true,
  },
  {
    type: "broadcast_sent",
    text: '⚙️ Ops broadcast to all agents: "Production deploy window"',
    time: "14m ago",
    hasLink: false,
    mobileHidden: true,
  },
] as const;

const demoBoard: KanbanPreviewColumn[] = [
  {
    id: "inbox",
    label: "Inbox",
    tasks: [
      {
        title: "Scope support handoff flow",
        assignees: [{ emoji: "🧠", name: "Research" }],
        priority: "medium",
        updatedAt: "2m",
      },
      {
        title: "Draft release update",
        assignees: [{ emoji: "✍️", name: "Writer" }],
        priority: "none",
        updatedAt: "5m",
        mobileHidden: true,
      },
    ],
  },
  {
    id: "in_progress",
    label: "In Progress",
    tasks: [
      {
        title: "Ship hero dashboard parity",
        assignees: [
          { emoji: "🛠️", name: "Builder" },
          { emoji: "🧪", name: "QA Agent" },
        ],
        priority: "high",
        updatedAt: "1m",
      },
      {
        title: "Verify OpenClaw route health",
        assignees: [{ emoji: "⚙️", name: "Ops" }],
        priority: "medium",
        updatedAt: "6m",
      },
    ],
  },
  {
    id: "done",
    label: "Done",
    tasks: [
      {
        title: "Provider key validation",
        assignees: [{ emoji: "🔐", name: "Security" }],
        priority: "none",
        updatedAt: "12m",
      },
      {
        title: "Agent setup rollback",
        assignees: [{ emoji: "✅", name: "QA" }],
        priority: "none",
        updatedAt: "18m",
        mobileHidden: true,
      },
    ],
  },
] as const;

const activityTypeMeta: Record<
  ActivityPreviewType,
  { icon: typeof Zap; color: "accent" | "emerald" | "amber" | "muted" }
> = {
  task_created: { icon: Zap, color: "accent" },
  task_updated: { icon: RefreshCw, color: "emerald" },
  message_sent: { icon: MessageSquare, color: "muted" },
  broadcast_sent: { icon: Radio, color: "accent" },
  mention_alert: { icon: AlertTriangle, color: "amber" },
  document_created: { icon: FileText, color: "muted" },
  document_updated: { icon: FileText, color: "muted" },
};

function activityColor(
  tone: (typeof activityTypeMeta)[ActivityPreviewType]["color"],
  palette: HeroDashboardCarouselPalette,
) {
  if (tone === "accent") return palette.accent;
  if (tone === "emerald") return palette.emerald;
  if (tone === "amber") return palette.amber;
  return "rgba(255,255,255,0.6)";
}

function priorityColor(
  priority: KanbanPreviewTask["priority"],
  palette: HeroDashboardCarouselPalette,
) {
  if (priority === "high") return palette.accent;
  if (priority === "medium") return palette.amber;
  return "rgba(255,255,255,0.35)";
}

const liveFeedCategoryChips = [
  { label: "All", count: demoFeed.length },
  {
    label: "Tasks",
    count: demoFeed.filter(
      (row) => row.type === "task_created" || row.type === "task_updated",
    ).length,
  },
  {
    label: "Docs",
    count: demoFeed.filter(
      (row) =>
        row.type === "document_created" || row.type === "document_updated",
    ).length,
  },
  {
    label: "Comments",
    count: demoFeed.filter((row) => row.type === "message_sent").length,
  },
  {
    label: "Broadcasts",
    count: demoFeed.filter((row) => row.type === "broadcast_sent").length,
  },
  {
    label: "Mentions",
    count: demoFeed.filter((row) => row.type === "mention_alert").length,
  },
] as const;

const shellDataPoints: Record<
  HeroCardKind,
  {
    syncLabel: string;
    metricLabel: string;
    metricValue: string;
    noteTitle: string;
    noteValue: string;
    stats: { label: string; value: string; hint: string }[];
  }
> = {
  agents: {
    syncLabel: "Agent roster synced",
    metricLabel: "Active now",
    metricValue: "3 / 4",
    noteTitle: "Agent health",
    noteValue: "All critical agents online",
    stats: [
      { label: "Agents", value: "4", hint: "1 idle" },
      { label: "Heartbeat", value: "2m", hint: "latest" },
      { label: "Mentions", value: "6", hint: "last hour" },
    ],
  },
  liveFeed: {
    syncLabel: "Event stream synced",
    metricLabel: "Events / min",
    metricValue: "27",
    noteTitle: "Live feed",
    noteValue: "Mentions and docs flowing",
    stats: [
      { label: "Tasks", value: "2", hint: "updated" },
      { label: "Docs", value: "2", hint: "changed" },
      { label: "Broadcasts", value: "1", hint: "pending read" },
    ],
  },
  kanban: {
    syncLabel: "Board state synced",
    metricLabel: "In progress",
    metricValue: "2",
    noteTitle: "Task flow",
    noteValue: "Review queue stable",
    stats: [
      { label: "Inbox", value: "2", hint: "triage" },
      { label: "Blocked", value: "0", hint: "clear" },
      { label: "Done", value: "2", hint: "today" },
    ],
  },
};

export function HeroDashboardCarousel({ palette }: HeroDashboardCarouselProps) {
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;
    const timer = window.setInterval(() => {
      setActiveCardIndex((prev) => (prev + 1) % cardOrder.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (touchResumeTimerRef.current) {
        clearTimeout(touchResumeTimerRef.current);
      }
    };
  }, []);

  const activeKind = cardOrder[activeCardIndex] ?? cardOrder[0];
  const activeMeta = cardMeta[activeKind];
  const activeData = shellDataPoints[activeKind];

  const pause = () => {
    setIsPaused(true);
  };

  const resume = () => {
    if (touchResumeTimerRef.current) {
      clearTimeout(touchResumeTimerRef.current);
      touchResumeTimerRef.current = null;
    }
    setIsPaused(false);
  };

  const handleTouchStart = () => {
    pause();
  };

  const handleTouchEnd = () => {
    if (touchResumeTimerRef.current) {
      clearTimeout(touchResumeTimerRef.current);
    }
    touchResumeTimerRef.current = setTimeout(() => {
      setIsPaused(false);
      touchResumeTimerRef.current = null;
    }, TOUCH_RESUME_DELAY_MS);
  };

  return (
    <div className="lp-float relative">
      <section
        className="relative overflow-hidden rounded-2xl"
        style={{
          border: `1px solid ${palette.border}`,
          backgroundColor: "rgba(12,14,22,0.9)",
          boxShadow: `0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px ${palette.border}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
        aria-label="Dashboard preview carousel"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: palette.border }}
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: "#EF4444", opacity: 0.5 }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: palette.amber, opacity: 0.5 }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: palette.emerald, opacity: 0.5 }}
              />
            </div>
            <span
              className="rounded-md px-3 py-0.5 text-[10px]"
              style={{
                backgroundColor: palette.surface,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              synclaw.in / dashboard
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: palette.accentDim,
                color: palette.accent,
              }}
              aria-live="polite"
            >
              {activeMeta.liveLabel}
            </span>
            <div
              className="flex items-center gap-1.5 text-[11px] font-medium"
              style={{ color: palette.emerald }}
            >
              <span
                className="lp-pulse h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: palette.emerald }}
              />
              Live
            </div>
          </div>
        </div>

        <div className="relative h-[318px] overflow-hidden sm:h-[338px]">
          {cardOrder.map((kind, index) => {
            const meta = cardMeta[kind];
            const isActive = activeCardIndex === index;
            return (
              <section
                key={kind}
                aria-hidden={!isActive}
                className={cn(
                  "absolute inset-0 p-3 transition-[opacity,transform] duration-[380ms] ease-out",
                  isActive
                    ? "opacity-100 translate-y-0 scale-100"
                    : "pointer-events-none opacity-0 translate-y-2 scale-[0.985]",
                )}
              >
                <div
                  className="flex items-center gap-2 px-1 pb-2 text-[9px] font-semibold uppercase tracking-widest"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  <meta.icon className="h-3.5 w-3.5" />
                  <span>{meta.label}</span>
                </div>

                {kind === "agents" ? (
                  <div className="space-y-2">
                    {demoAgents.map((agent) => (
                      <article
                        key={agent.name}
                        className={cn(
                          "rounded-xl border p-3",
                          agent.mobileHidden ? "hidden sm:block" : "block",
                        )}
                        style={{
                          borderColor: palette.border,
                          backgroundColor: palette.surface,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px]">{agent.emoji}</span>
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    agent.status === "active"
                                      ? palette.emerald
                                      : "rgba(255,255,255,0.24)",
                                }}
                              />
                              <p
                                className="truncate text-[11px] font-semibold"
                                style={{ color: "rgba(255,255,255,0.72)" }}
                              >
                                {agent.name}
                              </p>
                            </div>
                            <p
                              className="mt-0.5 pl-[24px] text-[10px]"
                              style={{ color: "rgba(255,255,255,0.33)" }}
                            >
                              {agent.role}
                            </p>
                            {agent.currentTask ? (
                              <div
                                className="mt-1.5 rounded-md px-2 py-1"
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.03)",
                                  border: `1px solid ${palette.border}`,
                                }}
                              >
                                <p
                                  className="truncate text-[10px]"
                                  style={{ color: "rgba(255,255,255,0.58)" }}
                                >
                                  Working on: {agent.currentTask}
                                </p>
                              </div>
                            ) : null}
                          </div>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-mono"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.03)",
                              color:
                                agent.status === "active"
                                  ? palette.emerald
                                  : "rgba(255,255,255,0.45)",
                            }}
                          >
                            {agent.status === "active" ? "active" : "idle"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className="text-[10px]"
                            style={{ color: "rgba(255,255,255,0.26)" }}
                          >
                            {agent.model}
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: "rgba(255,255,255,0.26)" }}
                          >
                            Heartbeat {agent.heartbeat}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {kind === "liveFeed" ? (
                  <div className="space-y-1.5">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {liveFeedCategoryChips.map((chip, chipIndex) => (
                        <span
                          key={chip.label}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px]"
                          style={{
                            borderColor:
                              chipIndex === 0 ? palette.accent : palette.border,
                            backgroundColor:
                              chipIndex === 0
                                ? palette.accentDim
                                : "rgba(255,255,255,0.02)",
                            color:
                              chipIndex === 0
                                ? palette.accent
                                : "rgba(255,255,255,0.52)",
                          }}
                        >
                          <span>{chip.label}</span>
                          <span className="font-mono">{chip.count}</span>
                        </span>
                      ))}
                    </div>
                    {demoFeed.map((item, rowIndex) => (
                      <article
                        key={item.text}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg px-2.5 py-2",
                          rowIndex > 3 && "opacity-60",
                          item.mobileHidden ? "hidden sm:flex" : "flex",
                        )}
                        style={{
                          backgroundColor:
                            rowIndex % 2 ? "transparent" : palette.surface,
                          border:
                            rowIndex % 2
                              ? "none"
                              : `1px solid ${palette.border}`,
                        }}
                      >
                        {(() => {
                          const metaByType = activityTypeMeta[item.type];
                          const Icon = metaByType.icon;
                          return (
                            <Icon
                              className="mt-0.5 h-3.5 w-3.5 shrink-0"
                              style={{
                                color: activityColor(metaByType.color, palette),
                              }}
                            />
                          );
                        })()}
                        <div className="min-w-0">
                          <p
                            className="truncate text-[11px]"
                            style={{ color: "rgba(255,255,255,0.66)" }}
                          >
                            {item.text}
                          </p>
                          <p
                            className="text-[10px]"
                            style={{ color: "rgba(255,255,255,0.26)" }}
                          >
                            {item.time}
                            {item.hasLink ? " • View →" : ""}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {kind === "kanban" ? (
                  <div className="grid grid-cols-3 gap-2">
                    {demoBoard.map((col) => (
                      <div
                        key={col.id}
                        className="rounded-lg border p-2"
                        style={{
                          borderColor: palette.border,
                          backgroundColor: "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-1">
                          <p
                            className="truncate text-[9px] font-semibold uppercase tracking-wider"
                            style={{ color: "rgba(255,255,255,0.4)" }}
                          >
                            {col.label}
                          </p>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-mono"
                            style={{
                              backgroundColor: palette.surface,
                              color: "rgba(255,255,255,0.52)",
                            }}
                          >
                            {col.tasks.length}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {col.tasks.map((task) => (
                            <article
                              key={task.title}
                              className={cn(
                                "rounded-md border px-2 py-1.5",
                                task.mobileHidden ? "hidden sm:block" : "block",
                              )}
                              style={{
                                borderColor: palette.border,
                                backgroundColor: palette.surface,
                              }}
                            >
                              <p
                                className="line-clamp-2 text-[10px] leading-tight"
                                style={{ color: "rgba(255,255,255,0.68)" }}
                              >
                                {task.title}
                              </p>
                              <div className="mt-1.5 flex items-center justify-between">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span
                                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]"
                                    style={{
                                      borderColor: palette.border,
                                      backgroundColor: "rgba(255,255,255,0.03)",
                                    }}
                                  >
                                    {task.assignees[0]?.emoji}
                                  </span>
                                  <span
                                    className="truncate text-[9px]"
                                    style={{ color: "rgba(255,255,255,0.56)" }}
                                  >
                                    {task.assignees[0]?.name}
                                  </span>
                                  {task.assignees.length > 1 ? (
                                    <span
                                      className="shrink-0 text-[9px]"
                                      style={{
                                        color: "rgba(255,255,255,0.34)",
                                      }}
                                    >
                                      +{task.assignees.length - 1}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{
                                      backgroundColor: priorityColor(
                                        task.priority,
                                        palette,
                                      ),
                                    }}
                                  />
                                  <span
                                    className="text-[9px]"
                                    style={{ color: "rgba(255,255,255,0.3)" }}
                                  >
                                    {task.updatedAt}
                                  </span>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        <div
          className="grid grid-cols-3 gap-2 border-t px-3 py-3"
          style={{ borderColor: palette.border }}
        >
          {activeData.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border px-2.5 py-2"
              style={{
                borderColor: palette.border,
                backgroundColor: "rgba(255,255,255,0.02)",
              }}
            >
              <p
                className="text-[9px] uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,0.36)" }}
              >
                {stat.label}
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "rgba(255,255,255,0.88)" }}
              >
                {stat.value}
              </p>
              <p
                className="text-[9px]"
                style={{ color: "rgba(255,255,255,0.42)" }}
              >
                {stat.hint}
              </p>
            </div>
          ))}
        </div>

        <div
          className="flex items-center justify-between border-t px-4 py-2.5"
          style={{ borderColor: palette.border }}
        >
          <div className="flex items-center gap-2">
            {cardOrder.map((kind, index) => {
              const isActive = activeCardIndex === index;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setActiveCardIndex(index);
                    setIsPaused(true);
                  }}
                  aria-label={`Show ${cardMeta[kind].label} preview`}
                  aria-pressed={isActive}
                  className={cn(
                    "h-2 w-2 rounded-full border transition-colors",
                    isActive ? "scale-110" : "opacity-80",
                  )}
                  style={{
                    borderColor: isActive ? palette.accent : palette.border,
                    backgroundColor: isActive
                      ? palette.accent
                      : "rgba(255,255,255,0.12)",
                  }}
                />
              );
            })}
          </div>

          <span
            className="text-[10px]"
            style={{ color: isPaused ? palette.amber : palette.dim }}
          >
            {isPaused
              ? "Paused"
              : activeKind === "agents"
                ? "4 agents • 3 active"
                : activeKind === "liveFeed"
                  ? "Last 7 days feed"
                  : "7 tasks in flow"}
          </span>
        </div>
      </section>

      <div className="pointer-events-none absolute -right-10 top-6 z-30 hidden xl:block">
        <div
          className="rounded-2xl border px-3.5 py-2.5 shadow-2xl"
          style={{
            borderColor: palette.borderStrong,
            backgroundColor: "rgba(8,10,15,0.94)",
          }}
        >
          <div className="flex items-center gap-2 text-[12px] font-medium">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(16,185,129,0.14)" }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: palette.emerald }}
              />
            </span>
            <span style={{ color: "rgba(255,255,255,0.86)" }}>
              {activeData.syncLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-12 top-1/2 z-30 hidden -translate-y-1/2 xl:block">
        <div
          className="rounded-2xl border px-4 py-3 shadow-2xl"
          style={{
            borderColor: palette.borderStrong,
            backgroundColor: "rgba(8,10,15,0.94)",
          }}
        >
          <p
            className="text-[11px]"
            style={{ color: "rgba(255,255,255,0.46)" }}
          >
            {activeData.metricLabel}
          </p>
          <p
            className="text-xl font-semibold"
            style={{ color: palette.accent }}
          >
            {activeData.metricValue}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-7 -left-8 z-30 hidden xl:block">
        <div
          className="rounded-2xl border px-3.5 py-2.5 shadow-2xl"
          style={{
            borderColor: palette.borderStrong,
            backgroundColor: "rgba(8,10,15,0.94)",
          }}
        >
          <p
            className="text-[12px] font-medium"
            style={{ color: "rgba(255,255,255,0.88)" }}
          >
            {activeData.noteTitle}
          </p>
          <p
            className="text-[11px]"
            style={{ color: "rgba(255,255,255,0.48)" }}
          >
            {activeData.noteValue}
          </p>
        </div>
      </div>
    </div>
  );
}
