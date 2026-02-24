# TOOLS.md - Z.AI CLI Reference

## Shared Tools (All Agents)

All agents have access to the following shared tools via `mcporter`:

| Tool | Usage | Best For |
|------|-------|----------|
| `lightpanda-scrape` | `lightpanda-scrape.scrape_page`, `lightpanda-scrape.list_links` | Dynamic sites, SPAs, and any **sutraha.in** URLs (session-persistent). |
| `web_fetch` | `web_fetch(url)` | Static documentation, fast text extraction, non-JS sites. |
| `mcporter` | `mcporter call <selector>` | Direct access to all configured MCP servers. |

---

## Web Scraping Rules (CRITICAL)

**⚠️ DO NOT USE OpenClaw's built-in `browser` tool** — it fails on headless Linux servers (no GUI) and requires Brave API.

**✅ ALWAYS use lightpanda-scrape for web scraping:**

```bash
# Single call that handles navigation + extraction
mcporter call lightpanda-scrape.scrape_page url="https://sutraha.in/..." wait_ms=3000

# To list all links on a page
mcporter call lightpanda-scrape.list_links
```

**Note:** `wait_ms` is optional (default: 3000ms). Increase if content takes longer to load.

**For static docs/simple pages only:**
- Use `web_fetch(url)` — faster, no rendering needed
- NOT for React/SPA sites like sutraha.in

**This applies to all agents:** Jarvis, Shuri, Vision, Ancient One, Friday

---

## Friday-Specific Tools

### Z.AI CLI
- **Path:** `~/.local/share/mise/installs/node/22.22.0/bin/zai-cli`
- **API Key:** Available via `Z_AI_API_KEY` environment variable (in openclaw.json)
- **Purpose:** Heavy code generation using GLM-4.7

## Available Commands

```bash
# Code mode (primary use)
~/.local/share/mise/installs/node/22.22.0/bin/zai-cli code <subcommand>

# Vision (image analysis)
zai-cli vision

# Web search
zai-cli search <query>

# Read web pages
zai-cli read <url>

# GitHub repo exploration
zai-cli repo <owner/repo>

# List available tools
zai-cli tools

# Show tool schema
zai-cli tool <tool-name>

# Call tool directly
zai-cli call <tool-name>
```

## Code Subcommands

```bash
# Run a TypeScript tool chain file
zai-cli code run ./chain.ts

# Execute inline code
zai-cli code eval "const r = await zai.search.webSearchPrime({...}); return r;"

# List available interfaces
zai-cli code interfaces

# Interactive prompt mode
zai-cli code prompt
```

## Usage Pattern

For coding tasks:
1. Receive task from Jarvis
2. Run z.ai CLI with task specification
3. Parse output (file changes)
4. Apply to repo via write tool
5. Commit via git-workflow.sh

## Helper Scripts

- **Code Runner:** `/root/.openclaw/.secrets/zai-code-runner.sh`
- **Git Workflow:** `/root/.openclaw/.secrets/git-workflow.sh`
- **Workflow Doc:** `/root/.openclaw/.secrets/ZAI_CODE_WORKFLOW.md`

## Workflow Commands

Always use these helpers to ensure consistent identity and safety:

```bash
# 1. Initialize/Update Repo
/root/.openclaw/.secrets/git-workflow.sh setup <repo>

# 2. Start Work (from develop)
/root/.openclaw/.secrets/git-workflow.sh branch <feature|bugfix|chore> <name>

# 3. Code Generation
# Use zai-cli directly or via code-runner

# 4. Commit Changes
/root/.openclaw/.secrets/git-workflow.sh commit "message"

# 5. Create Pull Request
/root/.openclaw/.secrets/git-workflow.sh pr <repo> "PR Title"
```
