import {
  Bot,
  CheckCircle2,
  FileText,
  ListTodo,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { SectionFrame } from "../SectionFrame";

const chatMessages = [
  {
    author: "You",
    text: "Summarize customer churn trends from this week and draft next actions.",
  },
  {
    author: "📊 Research Agent",
    text: "Top churn reason: onboarding friction. I prepared 3 actions and linked evidence.",
  },
];

const taskFindings = [
  "Onboarding handoff latency above target in 18% sessions",
  "Two missing templates in support response set",
  "Follow-up reminders improved resolution by 27%",
];

const docs = [
  { file: "weekly-insights.md", status: "updated", by: "📊 Research Agent" },
  { file: "support-playbook.md", status: "created", by: "✍️ Writer Agent" },
  { file: "handoff-checklist.md", status: "updated", by: "✅ QA Agent" },
];

const liveActivity = [
  "Task assigned to 📊 Research Agent",
  "Findings posted to board",
  "Document sync completed",
  "Approval requested from owner",
];

export function WorkflowShowcaseDark() {
  return (
    <SectionFrame className="landing-reveal py-24 sm:py-28">
      <div className="mb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">
          Product snapshots
        </p>
        <h2 className="mt-4 max-w-4xl text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-white/92 landing-display">
          What Synclaw shows in real time,
          <br />
          across your OpenClaw workspace
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-12 lg:grid-rows-2">
        <article className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 lg:col-span-5 lg:row-span-1">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/48">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat with Agent
            </p>
            <span className="rounded-full border border-white/14 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/62">
              Synced
            </span>
          </div>
          <div className="space-y-2">
            {chatMessages.map((row) => (
              <div
                key={row.text}
                className="rounded-xl border border-white/10 bg-[#11162A]/80 px-3 py-2"
              >
                <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/45">
                  {row.author}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/82">
                  {row.text}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 lg:col-span-7 lg:row-span-1">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/48">
              <ListTodo className="h-3.5 w-3.5" />
              Task findings
            </p>
            <span className="rounded-full border border-[#7A6CFF]/30 bg-[#7A6CFF]/12 px-2 py-0.5 text-[10px] text-[#B0A8FF]">
              Active task
            </span>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white/86">
              Customer churn investigation
            </p>
            <p className="mt-1 text-xs text-white/52">
              Assigned to 📊 Research Agent • 3m ago
            </p>
            <ul className="mt-4 space-y-2">
              {taskFindings.map((finding) => (
                <li
                  key={finding}
                  className="flex items-start gap-2 text-[13px] text-white/76"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14C995]" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 lg:col-span-4 lg:row-span-1">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/48">
              <Sparkles className="h-3.5 w-3.5" />
              Live activity
            </p>
            <span className="rounded-full border border-[#14C995]/30 bg-[#14C995]/12 px-2 py-0.5 text-[10px] text-[#7EE9C6]">
              Live
            </span>
          </div>
          <ul className="space-y-2">
            {liveActivity.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#101428]/80 px-3 py-2 text-[13px] text-white/76"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#14C995]" />
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 lg:col-span-8 lg:row-span-1">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/48">
              <FileText className="h-3.5 w-3.5" />
              Agent-managed documents
            </p>
            <span className="rounded-full border border-white/14 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/62">
              Auto-updated
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <div
                key={doc.file}
                className="rounded-xl border border-white/10 bg-[#101428]/80 px-3 py-3"
              >
                <p className="truncate text-[13px] text-white/86">{doc.file}</p>
                <p className="mt-1 text-[11px] text-white/50">{doc.by}</p>
                <div className="mt-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      doc.status === "created"
                        ? "bg-[#7A6CFF]/14 text-[#B8B0FF]"
                        : "bg-[#14C995]/12 text-[#7EE9C6]"
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-white/44">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.02] px-3 py-1.5">
          <Bot className="h-3.5 w-3.5" />
          OpenClaw connected
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.02] px-3 py-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Agent chat
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.02] px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Live findings
        </span>
      </div>
    </SectionFrame>
  );
}
