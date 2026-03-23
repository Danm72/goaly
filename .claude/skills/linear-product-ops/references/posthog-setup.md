# PostHog Integration Setup

## Install PostHog MCP Server

PostHog has an official MCP server. Install it for Claude Code:

```bash
claude mcp add --transport http posthog https://mcp.posthog.com/mcp -s user
```

Or add to `.mcp.json` manually:

```json
{
  "mcpServers": {
    "posthog": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote@latest",
        "https://mcp.posthog.com/mcp",
        "--header", "Authorization:${POSTHOG_AUTH_HEADER}"
      ],
      "env": {
        "POSTHOG_AUTH_HEADER": "Bearer phx_your_api_key_here"
      }
    }
  }
}
```

## Authentication

1. Create a Personal API Key at PostHog > Settings > Personal API Keys
2. Required scopes: `query:read`, `event_definition:read`, `property_definition:read`, `feature_flag:read`
3. Store as `POSTHOG_AUTH_HEADER` environment variable

## Key MCP Tools

| Tool | Purpose | Used By |
|------|---------|---------|
| `event-definitions-list` | List all defined events | MEASURE — instrumentation check |
| `query-run` | Run trends, funnels, HogQL queries | MEASURE — volumes and funnels |
| `feature-flag-get-all` | List all feature flags | MEASURE — flag status check |
| `read-data-schema` | Explore events, actions, properties | AUDIT — discover untracked events |

## Query Patterns

### Is this event firing?

```json
{
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT count() FROM events WHERE event = 'my_event' AND timestamp > now() - INTERVAL 7 DAY"
  }
}
```

### Event volume over 7 days (daily breakdown)

```json
{
  "query": {
    "kind": "TrendsQuery",
    "series": [{"kind": "EventsNode", "event": "my_event"}],
    "dateRange": {"date_from": "-7d", "date_to": "now"},
    "interval": "day"
  }
}
```

### Funnel conversion rate

```json
{
  "query": {
    "kind": "FunnelsQuery",
    "series": [
      {"kind": "EventsNode", "event": "step_1"},
      {"kind": "EventsNode", "event": "step_2"},
      {"kind": "EventsNode", "event": "step_3"}
    ],
    "dateRange": {"date_from": "-30d", "date_to": "now"}
  }
}
```

### Custom success target query

```json
{
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT countIf(event = 'job_card_clicked') / countIf(event = 'job_board_index_viewed') * 100 as click_rate FROM events WHERE timestamp > now() - INTERVAL 7 DAY AND event IN ('job_board_index_viewed', 'job_card_clicked')"
  }
}
```

## Configuration

Add to `config.json`:

```json
{
  "posthog_project_id": "<your-project-id>",
  "posthog_host": "https://us.posthog.com",
  "measure_default_period": "7d"
}
```

## Not Yet Operational

Client-B's PostHog account exists but is not yet set up (see Linear issue Client-B-55). The MEASURE mode will report "PostHog not configured" until:
1. PostHog MCP server is installed
2. API key is configured
3. Events are actually being instrumented in the Rails app

The event registry can be maintained NOW (during INGEST). MEASURE activates when PostHog goes live.
