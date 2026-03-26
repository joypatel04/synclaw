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
};

type KanbanPreviewColumn = {
  id: "inbox" | "in_progress" | "done";
  label: string;
  tasks: KanbanPreviewTask[];
};

const ROTATION_INTERVAL_MS = 6800;
const TOUCH_RESUME_DELAY_MS = 1200;

const cardOrder: HeroCardKind[] = ["agents", "liveFeed", "kanban"];

const cardMeta: Record<
  HeroCardKind,
  { label: string; icon: typeof Bot; liveLabel: string }
> = {
  agents: { label: "Agents", icon: Bot, liveLabel: "Agents" },
  liveFeed: { label: "Live Feed", icon: Activity, liveLabel: "Live Feed" },
  kanban: { label: "Kanban", icon: LayoutDashboard, liveLabel: "Tasks" },
};

const demoAgents: AgentPreviewRow[] = [
  {
    emoji: "🧠",
    name: "Research",
    role: "Analyst",
    status: "active",
    model: "gpt-5.1",
    heartbeat: "2m ago",
    currentTask: "Draft rollout narrative",
  },
  {
    emoji: "✍️",
    name: "Writer",
    role: "Content",
    status: "active",
    model: "claude-sonnet",
    heartbeat: "5m ago",
    currentTask: "Homepage copy polish",
  },
  {
    emoji: "🧪",
    name: "QA Agent",
    role: "Validation",
    status: "idle",
    model: "gemini-2.5",
    heartbeat: "14m ago",
  },
];

const demoFeed: LiveFeedPreviewRow[] = [
  {
    type: "task_created",
    text: 'Research created "Hero parity pass"',
    time: "2m ago",
    hasLink: true,
  },
  {
    type: "task_updated",
    text: 'Ops moved "Provider verify" to in progress',
    time: "4m ago",
    hasLink: true,
  },
  {
    type: "message_sent",
    text: 'Writer: "Copy contrast updated for light band"',
    time: "6m ago",
    hasLink: false,
  },
  {
    type: "document_created",
    text: 'Created "Launch checklist"',
    time: "8m ago",
    hasLink: true,
  },
  {
    type: "mention_alert",
    text: "Mentioned QA Agent for final pass",
    time: "12m ago",
    hasLink: false,
  },
];

const demoBoard: KanbanPreviewColumn[] = [
  {
    id: "inbox",
    label: "Inbox",
    tasks: [
      {
        title: "Scope support handoff",
        assignees: [{ emoji: "🧠", name: "Research" }],
        priority: "medium",
        updatedAt: "2m",
      },
    ],
  },
  {
    id: "in_progress",
    label: "In Progress",
    tasks: [
      {
        title: "Polish dark-light transitions",
        assignees: [
          { emoji: "🛠️", name: "Builder" },
          { emoji: "🧪", name: "QA Agent" },
        ],
        priority: "high",
        updatedAt: "1m",
      },
      {
        title: "Review public-wss docs links",
        assignees: [{ emoji: "⚙️", name: "Ops" }],
        priority: "none",
        updatedAt: "9m",
      },
    ],
  },
  {
    id: "done",
    label: "Done",
    tasks: [
      {
        title: "Provider model defaults",
        assignees: [{ emoji: "✅", name: "QA" }],
        priority: "none",
        updatedAt: "16m",
      },
    ],
  },
];

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
  return "rgba(255,255,255,0.58)";
}

function priorityColor(
  priority: KanbanPreviewTask["priority"],
  palette: HeroDashboardCarouselPalette,
) {
  if (priority === "high") return palette.accent;
  if (priority === "medium") return palette.amber;
  return "rgba(255,255,255,0.33)";
}

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
    metricValue: "2 / 3",
    noteTitle: "Agent health",
    noteValue: "All critical agents online",
    stats: [
      { label: "Agents", value: "3", hint: "1 idle" },
      { label: "Heartbeat", value: "2m", hint: "latest" },
      { label: "Mentions", value: "4", hint: "last hour" },
    ],
  },
  liveFeed: {
    syncLabel: "Event stream synced",
    metricLabel: "Events / min",
    metricValue: "19",
    noteTitle: "Live feed",
    noteValue: "Stable event throughput",
    stats: [
      { label: "Tasks", value: "2", hint: "updated" },
      { label: "Docs", value: "1", hint: "changed" },
      { label: "Mentions", value: "1", hint: "pending" },
    ],
  },
  kanban: {
    syncLabel: "Board state synced",
    metricLabel: "In progress",
    metricValue: "2",
    noteTitle: "Task flow",
    noteValue: "No blockers detected",
    stats: [
      { label: "Inbox", value: "1", hint: "triage" },
      { label: "Done", value: "1", hint: "today" },
      { label: "Blocked", value: "0", hint: "clear" },
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

  const pause = () => setIsPaused(true);

  const resume = () => {
    if (touchResumeTimerRef.current) {
      clearTimeout(touchResumeTimerRef.current);
      touchResumeTimerRef.current = null;
    }
    setIsPaused(false);
  };

  const handleTouchStart = () => pause();

  const handleTouchEnd = () => {
    if (touchResumeTimerRef.current) clearTimeout(touchResumeTimerRef.current);
    touchResumeTimerRef.current = setTimeout(() => {
      setIsPaused(false);
      touchResumeTimerRef.current = null;
    }, TOUCH_RESUME_DELAY_MS);
  };

  return (
    <div className="lp-float relative isolate">
      <section
        className="relative z-10 overflow-hidden rounded-[22px]"
        style={{
          border: `1px solid ${palette.border}`,
          backgroundColor: "rgba(9,12,20,0.9)",
          boxShadow: `0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)`,
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
                style={{ backgroundColor: "#EF4444", opacity: 0.45 }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: palette.amber, opacity: 0.45 }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: palette.emerald, opacity: 0.45 }}
              />
            </div>
            <span
              className="rounded-md px-3 py-0.5 text-[10px]"
              style={{
                backgroundColor: palette.surface,
                color: "rgba(255,255,255,0.34)",
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

        <div className="relative h-[306px] overflow-hidden sm:h-[326px]">
          {cardOrder.map((kind, index) => {
            const meta = cardMeta[kind];
            const isActive = activeCardIndex === index;

            return (
              <section
                key={kind}
                aria-hidden={!isActive}
                className={cn(
                  "absolute inset-0 p-3 transition-[opacity,transform] duration-[700ms] ease-out",
                  isActive
                    ? "translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none translate-y-2 scale-[0.986] opacity-0",
                )}
              >
                <div
                  className="flex items-center gap-2 px-1 pb-2 text-[9px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(255,255,255,0.28)" }}
                >
                  <meta.icon className="h-3.5 w-3.5" />
                  <span>{meta.label}</span>
                </div>

                {kind === "agents" ? (
                  <div className="space-y-2.5">
                    {demoAgents.map((agent) => (
                      <article
                        key={agent.name}
                        className="rounded-xl border p-3"
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
                                style={{ color: "rgba(255,255,255,0.74)" }}
                              >
                                {agent.name}
                              </p>
                            </div>
                            <p
                              className="mt-0.5 pl-[24px] text-[10px]"
                              style={{ color: "rgba(255,255,255,0.36)" }}
                            >
                              {agent.role}
                            </p>
                            {agent.currentTask ? (
                              <p
                                className="mt-1.5 truncate rounded-md border px-2 py-1 text-[10px]"
                                style={{
                                  borderColor: palette.border,
                                  backgroundColor: "rgba(255,255,255,0.03)",
                                  color: "rgba(255,255,255,0.58)",
                                }}
                              >
                                {agent.currentTask}
                              </p>
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
                            {agent.status}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className="text-[10px]"
                            style={{ color: "rgba(255,255,255,0.28)" }}
                          >
                            {agent.model}
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: "rgba(255,255,255,0.28)" }}
                          >
                            {agent.heartbeat}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {kind === "liveFeed" ? (
                  <div className="space-y-2">
                    {demoFeed.map((item, rowIndex) => {
                      const typeMeta = activityTypeMeta[item.type];
                      const Icon = typeMeta.icon;

                      return (
                        <article
                          key={item.text}
                          className="flex items-start gap-2.5 rounded-lg border px-2.5 py-2"
                          style={{
                            borderColor: palette.border,
                            backgroundColor:
                              rowIndex % 2
                                ? "rgba(255,255,255,0.012)"
                                : palette.surface,
                          }}
                        >
                          <Icon
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            style={{
                              color: activityColor(typeMeta.color, palette),
                            }}
                          />
                          <div className="min-w-0">
                            <p
                              className="truncate text-[11px]"
                              style={{ color: "rgba(255,255,255,0.69)" }}
                            >
                              {item.text}
                            </p>
                            <p
                              className="text-[10px]"
                              style={{ color: "rgba(255,255,255,0.28)" }}
                            >
                              {item.time}
                              {item.hasLink ? " • view" : ""}
                            </p>
                          </div>
                        </article>
                      );
                    })}
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
                          backgroundColor: "rgba(255,255,255,0.018)",
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-1">
                          <p
                            className="truncate text-[9px] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: "rgba(255,255,255,0.41)" }}
                          >
                            {col.label}
                          </p>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-mono"
                            style={{
                              backgroundColor: palette.surface,
                              color: "rgba(255,255,255,0.56)",
                            }}
                          >
                            {col.tasks.length}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {col.tasks.map((task) => (
                            <article
                              key={task.title}
                              className="rounded-md border px-2 py-1.5"
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
                                    style={{ color: "rgba(255,255,255,0.55)" }}
                                  >
                                    {task.assignees[0]?.name}
                                  </span>
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
                                    style={{ color: "rgba(255,255,255,0.31)" }}
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
                className="text-[9px] uppercase tracking-[0.12em]"
                style={{ color: "rgba(255,255,255,0.38)" }}
              >
                {stat.label}
              </p>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                {stat.value}
              </p>
              <p
                className="text-[9px]"
                style={{ color: "rgba(255,255,255,0.44)" }}
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
                    "h-2 w-2 rounded-full border transition-all",
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
                ? "3 agents • 2 active"
                : activeKind === "liveFeed"
                  ? "5 latest events"
                  : "4 tasks in flow"}
          </span>
        </div>
      </section>

      <div className="pointer-events-none absolute -right-10 top-8 z-50 hidden lg:block">
        <div
          className="rounded-2xl border px-3.5 py-2.5"
          style={{
            borderColor: palette.borderStrong,
            backgroundColor: "rgba(8,10,15,0.92)",
            boxShadow: "0 24px 55px rgba(0,0,0,0.4)",
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

      <div className="pointer-events-none absolute -right-12 top-1/2 z-50 hidden -translate-y-1/2 lg:block">
        <div
          className="rounded-2xl border px-4 py-3"
          style={{
            borderColor: palette.borderStrong,
            backgroundColor: "rgba(8,10,15,0.92)",
            boxShadow: "0 24px 55px rgba(0,0,0,0.4)",
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

      <div className="pointer-events-none absolute -bottom-7 -left-8 z-50 hidden lg:block">
        <div
          className="rounded-2xl border px-3.5 py-2.5"
          style={{
            borderColor: palette.borderStrong,
            backgroundColor: "rgba(8,10,15,0.92)",
            boxShadow: "0 24px 55px rgba(0,0,0,0.4)",
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
