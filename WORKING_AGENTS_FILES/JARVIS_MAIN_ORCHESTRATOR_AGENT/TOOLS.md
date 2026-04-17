# TOOLS.md - Local Notes

## Shared Tools (All Agents)

All agents have access to following shared tools via `mcporter`:

| Tool | Usage | Best For |
|------|-------|----------|
| `lightpanda-scrape` | `lightpanda-scrape.scrape_page`, `lightpanda-scrape.list_links` | Dynamic sites, SPAs, and any **synclaw.in** URLs (session-persistent). |
| `web_fetch` | `web_fetch(url)` | Static documentation, fast text extraction, non-JS sites. |
| `mcporter` | `mcporter call <selector>` | Direct access to all configured MCP servers. |

---

## Web Scraping Rules (CRITICAL)

**⚠️ DO NOT USE OpenClaw's built-in `browser` tool** — it fails on headless Linux servers (no GUI) and requires Brave API.

**✅ ALWAYS use lightpanda-scrape for web scraping:**

```bash
# Single call that handles navigation + extraction
mcporter call lightpanda-scrape.scrape_page url="https://synclaw.in/..." wait_ms=3000

# To list all links on a page
mcporter call lightpanda-scrape.list_links
```

**Note:** `wait_ms` is optional (default: 3000ms). Increase if content takes longer to load.

**For static docs/simple pages only:**
- Use `web_fetch(url)` — faster, no rendering needed
- NOT for React/SPA sites like synclaw.in

**This applies to all agents:** Jarvis, Shuri, Vision, Ancient One, Friday

---