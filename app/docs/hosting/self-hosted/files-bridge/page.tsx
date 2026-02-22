import { FolderTree } from "lucide-react";
import {
  PublicDocsCallout,
  PublicDocsCard,
  PublicDocsCodeBlock,
  PublicDocsShell,
} from "@/app/docs/_components/PublicDocsShell";

export default function HostingSelfHostedFilesBridgePage() {
  return (
    <PublicDocsShell
      title="Self-hosted: OpenClaw Files Bridge"
      description="Run a Dockerized bridge so Sutraha HQ can browse and edit remote OpenClaw workspace files."
      icon={FolderTree}
    >
      <PublicDocsCard title="What this unlocks">
        <ul className="list-disc space-y-2 pl-5">
          <li>Browse remote workspace directory tree from Sutraha HQ.</li>
          <li>Edit and save text files (`.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`, `.config`).</li>
          <li>Edit `openclaw.config` directly in <code className="rounded bg-bg-primary px-1 py-0.5">Settings -&gt; OpenClaw</code>.</li>
          <li>Keep bridge token server-side (never exposed to browser).</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="1) Run the bridge with Docker">
        <PublicDocsCodeBlock
          title="Build + run"
          code={`cd packages/fs-bridge
docker build -t sutraha-fs-bridge .

docker run --rm -p 8787:8787 \\
  -e FS_BRIDGE_TOKEN="replace_me" \\
  -e WORKSPACE_ROOT_PATH="/srv/openclaw/workspaces/main" \\
  -e FS_MAX_FILE_BYTES="1048576" \\
  -e FS_ALLOWED_EXTENSIONS=".md,.txt,.json,.yaml,.yml,.toml,.config" \\
  -v /srv/openclaw/workspaces/main:/srv/openclaw/workspaces/main \\
  sutraha-fs-bridge`}
        />
        <PublicDocsCallout title="Per-user root path">
          Each customer can run their own bridge instance and set their own
          `WORKSPACE_ROOT_PATH` to whatever directory contains their OpenClaw workspace.
        </PublicDocsCallout>
      </PublicDocsCard>

      <PublicDocsCard title="2) Publish image (optional)">
        <PublicDocsCodeBlock
          title="GHCR example"
          code={`docker tag sutraha-fs-bridge ghcr.io/sutraha/sutraha-fs-bridge:0.1.0
docker push ghcr.io/sutraha/sutraha-fs-bridge:0.1.0`}
        />
      </PublicDocsCard>

      <PublicDocsCard title="3) Configure Sutraha HQ">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Enable feature flag: <code className="rounded bg-bg-primary px-1 py-0.5">NEXT_PUBLIC_OPENCLAW_FILES_ENABLED=true</code>.</li>
          <li>Open <code className="rounded bg-bg-primary px-1 py-0.5">Settings -&gt; OpenClaw</code>.</li>
          <li>Enable <span className="font-medium">Workspace Files Bridge</span>.</li>
          <li>Set bridge URL and workspace root path.</li>
          <li>Set bridge token and click Save.</li>
          <li>Use <span className="font-medium">Workspace Files (Remote)</span> and click Test bridge.</li>
        </ol>
      </PublicDocsCard>

      <PublicDocsCard title="4) Security baseline">
        <ul className="list-disc space-y-2 pl-5">
          <li>Use a strong unique <code className="rounded bg-bg-primary px-1 py-0.5">FS_BRIDGE_TOKEN</code> per bridge deployment.</li>
          <li>Expose bridge behind HTTPS and private networking when possible.</li>
          <li>Keep root path minimal (only agent workspace directory, not full server root).</li>
          <li>Do not allow binary extensions in v1.</li>
          <li>Monitor 401/403/409 errors in logs and rotate token when needed.</li>
        </ul>
      </PublicDocsCard>

      <PublicDocsCard title="5) Troubleshooting">
        <PublicDocsCodeBlock
          title="Quick checks"
          code={`# 1) health check
curl -H "Authorization: Bearer <token>" https://<bridge-host>/health

# 2) list root
curl -H "Authorization: Bearer <token>" "https://<bridge-host>/v1/tree?path=."

# 3) read file
curl -H "Authorization: Bearer <token>" "https://<bridge-host>/v1/file?path=openclaw.config"`}
        />
      </PublicDocsCard>
    </PublicDocsShell>
  );
}

