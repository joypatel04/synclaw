"use client";

import { HardDrive } from "lucide-react";
import { DocsCard, DocsFrame } from "@/app/help/_components/DocsFrame";

export default function SelfHostedDocsPage() {
  return (
    <DocsFrame
      title="Self-hosted OSS Setup"
      description="Developer-grade deployment with your own infra."
      icon={HardDrive}
    >
      <div className="space-y-6">
        <DocsCard title="Intended audience">
          <ul className="list-disc space-y-2 pl-5">
            <li>Developers comfortable with environment variables, OAuth apps, and deployment pipelines.</li>
            <li>Teams that need infrastructure ownership and deeper customization.</li>
            <li>Users who accept higher setup and maintenance overhead.</li>
          </ul>
        </DocsCard>

        <DocsCard title="Prerequisites">
          <ul className="list-disc space-y-2 pl-5">
            <li>Node.js/Bun runtime and ability to run Next.js + Convex locally.</li>
            <li>Your own Convex project (dev + production deployments).</li>
            <li>OpenClaw gateway and MCP server access.</li>
            <li>OAuth provider app credentials (GitHub; add Google if needed).</li>
          </ul>
        </DocsCard>

        <DocsCard title="Setup flow">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Clone repository and configure `.env.local` from `.env.local.example`.</li>
            <li>Run `bunx convex dev` and `bun run dev`.</li>
            <li>Configure auth provider callbacks to match your local/prod URLs.</li>
            <li>Set OpenClaw values in `Settings → OpenClaw` per workspace.</li>
            <li>Create agents and verify heartbeat/activity flow.</li>
            <li>Deploy app + Convex functions to production environments.</li>
          </ol>
        </DocsCard>

        <DocsCard title="Why this path feels harder">
          <ul className="list-disc space-y-2 pl-5">
            <li>You manage every integration and incident response path.</li>
            <li>You own deployment correctness across app, backend, and external providers.</li>
            <li>You maintain ongoing compatibility for OpenClaw/MCP/provider changes.</li>
          </ul>
        </DocsCard>
      </div>
    </DocsFrame>
  );
}

