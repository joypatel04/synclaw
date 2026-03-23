"use client";

import { Activity, Bot, LayoutDashboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type HeroCardKind = "agents" | "liveFeed" | "kanban";

type HeroDashboardCarouselPalette = {
  surface: string;
  border: string;
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
  name: string;
  role: string;
  status: "active" | "idle";
  model: string;
  cost: string;
  mobileHidden?: boolean;
};

type LiveFeedPreviewRow = {
  text: string;
  time: string;
  tone: "ok" | "info" | "warn";
  mobileHidden?: boolean;
};

type KanbanPreviewTask = {
  title: string;
  assignee: string;
  priority: "P1" | "P2" | "P3" | "Done";
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
    name: "Research",
    role: "Analyst",
    status: "active",
    model: "gpt-5.1",
    cost: "$1.24",
  },
  {
    name: "Writer",
    role: "Content",
    status: "active",
    model: "claude-sonnet",
    cost: "$0.87",
  },
  {
    name: "QA Agent",
    role: "Validation",
    status: "idle",
    model: "gemini-2.5",
    cost: "$0.12",
  },
  {
    name: "Ops",
    role: "Deploy",
    status: "active",
    model: "gpt-5.1",
    cost: "$0.44",
    mobileHidden: true,
  },
] as const;

const demoFeed: LiveFeedPreviewRow[] = [
  { text: "Task completed: Research brief", time: "2m ago", tone: "ok" },
  { text: "Writer started: Landing page draft", time: "4m ago", tone: "info" },
  { text: "Cost update: $0.08 this session", time: "5m ago", tone: "warn" },
  { text: "Task moved to In Progress", time: "7m ago", tone: "info" },
  {
    text: "Heartbeat: QA Agent online",
    time: "11m ago",
    tone: "ok",
    mobileHidden: true,
  },
  {
    text: "Review approved: onboarding copy",
    time: "14m ago",
    tone: "ok",
    mobileHidden: true,
  },
] as const;

const demoBoard: KanbanPreviewColumn[] = [
  {
    id: "inbox",
    label: "Inbox",
    tasks: [
      { title: "Scope new support flow", assignee: "🧠", priority: "P2" },
      {
        title: "Draft release update",
        assignee: "✍️",
        priority: "P3",
        mobileHidden: true,
      },
    ],
  },
  {
    id: "in_progress",
    label: "In Progress",
    tasks: [
      { title: "Ship hero animation", assignee: "🛠️", priority: "P1" },
      { title: "Verify OpenClaw health", assignee: "🤖", priority: "P2" },
    ],
  },
  {
    id: "done",
    label: "Done",
    tasks: [
      { title: "Provider key validation", assignee: "🔐", priority: "Done" },
      {
        title: "Agent setup rollback",
        assignee: "✅",
        priority: "Done",
        mobileHidden: true,
      },
    ],
  },
] as const;

function toneColor(
  tone: LiveFeedPreviewRow["tone"],
  palette: HeroDashboardCarouselPalette,
) {
  if (tone === "ok") return palette.emerald;
  if (tone === "warn") return palette.amber;
  return palette.accent;
}

function priorityColor(
  priority: KanbanPreviewTask["priority"],
  palette: HeroDashboardCarouselPalette,
) {
  if (priority === "P1") return palette.accent;
  if (priority === "P2") return palette.amber;
  if (priority === "Done") return palette.emerald;
  return "rgba(255,255,255,0.35)";
}

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
    <div className="lp-float">
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
                          "rounded-lg border px-3 py-2.5",
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
                              className="mt-0.5 pl-3.5 text-[10px]"
                              style={{ color: "rgba(255,255,255,0.33)" }}
                            >
                              {agent.role} • {agent.model}
                            </p>
                          </div>
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-mono"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.03)",
                              color: "rgba(255,255,255,0.45)",
                            }}
                          >
                            {agent.cost}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {kind === "liveFeed" ? (
                  <div className="space-y-1.5">
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
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: toneColor(item.tone, palette),
                          }}
                        />
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
                                <span className="text-[10px]">
                                  {task.assignee}
                                </span>
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    backgroundColor: priorityColor(
                                      task.priority,
                                      palette,
                                    ),
                                  }}
                                />
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
            {isPaused ? "Paused" : "Auto rotating"}
          </span>
        </div>
      </section>
    </div>
  );
}
