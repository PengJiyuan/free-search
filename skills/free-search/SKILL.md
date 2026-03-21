---
name: free-search
description: Use this skill whenever the user wants web research, search aggregation, or a Tavily-style workflow without paid API keys. Especially use it when the user wants structured research summaries from web sources and is OK using a local SearXNG service for stable JSON search results.
---

# Free Search

Use a local SearXNG service so Claude can do structured web research without paid APIs.

## When to use

Use this skill for:

- web research tasks
- search aggregation across multiple engines
- Tavily-like workflows using local infrastructure
- structured research summaries with explicit sources and caveats

## Prerequisites

- A local or explicitly approved SearXNG instance must be reachable.
- The default endpoint is `http://127.0.0.1:8080`.
- If local SearXNG is not running yet, start it with `python3 scripts/start_searxng.py` from the installed skill root.

Primary environment variables:

- `SEARXNG_BASE_URL`
- `ALLOW_REMOTE_SEARXNG`
- `MAX_RESULTS`

## Workflow

1. Confirm the user's query.
2. Ensure SearXNG is reachable. If needed, run `python3 scripts/start_searxng.py`.
3. Run `node scripts/free-search.js "<query>"` from the installed skill root.
4. Return the generated markdown report to the user.

## Output format

Always keep this section structure:

- `## Summary`
- `## Key Findings`
- `## Sources`
- `## Caveats`

## Failure handling

- Success writes the final markdown report to stdout.
- User-actionable failures write to stderr and exit non-zero.
- If SearXNG is unavailable, tell the user to confirm the service is running and reachable at `SEARXNG_BASE_URL`.

## Notes

- `skills/free-search/` is the canonical GitHub source layout.
- `.claude/skills/free-search/` is only the local installed layout if the user copies or symlinks the skill into Claude Code.
- This skill summarizes search result metadata from local SearXNG. It does not fetch and read full page content.
