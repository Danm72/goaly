# Research & Web Scraping Tools

MCP servers, CLI tools, and APIs available for deep research, competitor analysis, web scraping, and brand validation.

### Perplexity MCP (stdio)
- **Package**: `@perplexity-ai/mcp-server`
- **Tools**: `perplexity_search` (web search), `perplexity_ask` (sonar-pro conversational), `perplexity_research` (deep research, 2-4 min/query), `perplexity_reason` (reasoning + search)
- **Best for**: Deep brand/competitor research on individual names, comprehensive market analysis
- **Cost**: ~$1/1K requests (sonar), citation tokens free
- **Batch strategy**: Use `perplexity_search` for fast first-pass on many items (~$0.005 each), `perplexity_research` only for finalists (expensive, slow)
- **Docs**: https://docs.perplexity.ai/guides/mcp-server

### Exa MCP (HTTP remote)
- **Endpoint**: `https://mcp.exa.ai/mcp`
- **Tools**: `web_search_exa` (web search), `web_search_advanced_exa` (filters, domains, dates), `company_research_exa` (company info + news), `crawling_exa` (extract content from URLs)
- **Best for**: Semantic company/brand similarity search, finding companies with similar names or positioning
- **Special**: Neural/semantic search — finds conceptually similar content, not just keyword matches. `category: "company"` searches a dedicated company index
- **Cost**: $5/1K searches + $1/1K pages. Free tier available (rate-limited)
- **Docs**: https://docs.exa.ai/reference/exa-mcp

### Tavily MCP (HTTP remote)
- **Endpoint**: `https://mcp.tavily.com/mcp/`
- **Tools**: `tavily-search` (web search), `tavily-extract` (page extraction), `tavily-map` (site mapping), `tavily-crawl` (systematic crawling)
- **Best for**: Web research + content extraction, fact-checking, RAG workflows
- **Cost**: $0.008/credit. Free dev tier: 1,000 credits/month, 100 RPM
- **Docs**: https://docs.tavily.com/documentation/mcp

### Instant Domain Search MCP (HTTP remote)
- **Endpoint**: `https://instantdomainsearch.com/mcp/streamable-http`
- **Tools**: `search_domains`, `generate_domain_variations`, `check_domain_availability`
- **Best for**: Quick domain availability checks, generating domain variations
- **Cost**: Free, no API key needed

### Sherlock (CLI, not MCP)
- **Install**: `pip install sherlock-project` (v0.16.0)
- **Usage**: `sherlock "name" --print-found --timeout 10`
- **Best for**: Social media handle availability across 400+ platforms
- **Cost**: Free, open source
- **Batch**: `sherlock name1 name2 name3 ...` or pipe from file
- **Repo**: https://github.com/sherlock-project/sherlock

### Firecrawl CLI (v1.9.8)
- **Install**: `npm install -g firecrawl-cli@latest` (already installed globally)
- **Auth**: `firecrawl login` (browser auth, credentials stored locally)
- **Status**: `firecrawl --status` (shows version, auth, concurrency, credits)
- **Credits**: 305 remaining (pay-as-you-go, ~$0.01/scrape)

**Core commands:**

| Command | Purpose | Example |
|---------|---------|---------|
| `scrape` | Extract clean markdown from URL(s) | `firecrawl scrape "https://example.com"` |
| `search` | Web search with full page content | `firecrawl search "query" --scrape --limit 3` |
| `map` | Discover all URLs on a site | `firecrawl map "https://docs.example.com"` |
| `crawl` | Bulk extract entire site sections | `firecrawl crawl "https://docs.example.com/api"` |
| `download` | Save site as local markdown files | `firecrawl download "https://docs.example.com" --limit 50` |
| `agent` | AI-powered structured data extraction | `firecrawl agent "find pricing for X" --urls "https://..."` |
| `browser` | Cloud Playwright browser sessions | `firecrawl browser "open https://example.com"` |

**Escalation pattern:** search → scrape → map+scrape → crawl → browser

**Key features (v1.9.8):**
- `agent` command: Natural language data extraction — two models: `spark-1-mini` (default, cheaper) and `spark-1-pro` (higher accuracy). Supports `--schema` for structured JSON output and `--max-credits` to cap spend.
- `browser` command: Cloud Playwright sessions — 3 modes: agent-browser commands (default), `--python`, or `--node`. Persistent profiles survive session close.
- `download` command: Maps + scrapes entire sites to `.firecrawl/` as nested markdown
- Batch scraping: `firecrawl scrape url1 url2 url3` runs concurrently
- Output to files: `-o .firecrawl/result.md` (`.firecrawl/` is gitignored)
- Self-hosted: `firecrawl --api-url http://localhost:3002 scrape "url"` — no API key needed
- Also available as MCP server and Claude Code skills (installed to `.agents/skills/`)

**When to use over MCP:**
- CLI is faster for quick one-off scrapes from bash
- MCP is better when called from within agent tool chains
- CLI `agent` command is unique — no MCP equivalent for AI extraction
- CLI `browser` command offers persistent cloud sessions with profiles

### Chrome DevTools MCP (stdio)
- **Package**: `chrome-devtools-mcp` (Google official)
- **Config**: `--autoConnect` (finds local Chrome 144+ automatically via `chrome://inspect/#remote-debugging`)
- **Tools**: Navigate, screenshot, execute JS, inspect DOM, network monitoring, performance profiling, device emulation
- **Best for**: Headless-style browser automation via Chrome DevTools Protocol — no extension needed. Performance audits, network inspection, device emulation.
- **Differs from Claude-in-Chrome**: No extension install, deeper DevTools access (performance, network, emulation), but no tab group management or GIF recording
- **Docs**: https://github.com/anthropics/chrome-devtools-mcp

### Cloudflare Browser Rendering /crawl
- **Endpoint**: `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering/crawl`
- **What it does**: Async crawling API — discovers pages via sitemaps/links, renders in headless Chrome, returns markdown/HTML/JSON
- **Auth**: Cloudflare account + API token with Browser Rendering permissions
- **Cost**: Workers Free = 10 min/day; Workers Paid = 10 hrs/month included, $0.09/hr after. `render: false` (static fetch) is **free during beta**.
- **Best for**: High-volume site crawling (up to 100K pages), incremental re-crawling, structured data extraction
- **Docs**: https://developers.cloudflare.com/browser-rendering/

**Async workflow:**
1. `POST /crawl` with URL + params → returns job ID immediately
2. `GET /crawl/{job_id}` to poll for results (jobs run up to 7 days, results retained 14 days)
3. `DELETE /crawl/{job_id}` to cancel

**Key parameters:**

| Parameter | Default | Notes |
|-----------|---------|-------|
| `url` | required | Starting URL |
| `limit` | 10 | Max pages (up to 100,000) |
| `formats` | `["html"]` | `html`, `markdown`, `json` (json uses Workers AI) |
| `render` | `true` | `false` = fast static fetch, free during beta |
| `maxAge` | 86400s | Cache TTL before re-fetching |
| `modifiedSince` | - | Unix timestamp, skip unchanged pages |
| `options.includePatterns` | - | Wildcard URL filters (e.g., `/docs/**`) |
| `options.excludePatterns` | - | Exclude filters (higher priority) |

**Usage:**
```bash
# Start crawl job
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering/crawl" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "formats": ["markdown"], "limit": 50}'

# Poll for results
curl "https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering/crawl/{job_id}" \
  -H "Authorization: Bearer {api_token}"
```

**Key features:**
- Full Chromium rendering on Cloudflare's edge
- Returns markdown, HTML, links, or structured JSON (via Workers AI + NL prompts)
- `render: false` for docs/blogs — skips browser, near-instant, free during beta
- Incremental crawling with `modifiedSince` — only re-crawl changed pages
- URL filtering with include/exclude patterns
- Respects `robots.txt` and `crawl-delay` (cannot bypass Cloudflare bot protection)
- Available on Workers Free and Paid plans

**When to use:**
- Have a Cloudflare account (works on Free plan)
- Need high-volume crawling without per-page API credits
- JS-heavy sites that `curl -H "Accept: text/markdown"` can't handle
- Incremental monitoring (re-crawl only changed pages)
- Building custom crawl pipelines with Workers

### Research Pipeline Pattern

For validating naming candidates or business ideas:

1. **Phase 1 — Fast screening** (all candidates)
   - Exa `company_research_exa` — check for existing companies with each name
   - Sherlock CLI — batch check social handle availability
   - Instant Domain Search — domain availability (if not already done)

2. **Phase 2 — Trademark check** (survivors from Phase 1)
   - EUIPO API (EU trademarks) — free, register at dev.euipo.europa.eu
   - USPTO via RapidAPI — free basic plan
   - Companies House API (UK) — free
   - CRO API (Ireland) — free, register at services.cro.ie

3. **Phase 3 — Deep research** (top 20-30 candidates)
   - Perplexity `perplexity_research` — full competitive landscape per name
   - Tavily `tavily-extract` + `tavily-crawl` — deep-dive on flagged competitors
   - Exa `web_search_advanced_exa` with domain/date filters — targeted research
