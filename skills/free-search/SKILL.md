---
name: free-search
description: Use this skill whenever the user asks for web research, search aggregation, source-backed summaries, or a Tavily-like workflow without paid APIs. Use it even when the user does not mention SearXNG explicitly but clearly wants a structured research pass with cited sources, especially if local SearXNG is available.
---

# Free Search

Use a local SearXNG service to produce a structured research summary with explicit sources, fetching top result pages for Mozilla Readability-based article detail when possible.

## Prerequisites

- Node.js, npm, and Python 3 must be available.
- A local or explicitly approved SearXNG instance must be reachable.
- The default endpoint is `http://127.0.0.1:12783`.
- If local SearXNG is not running yet, start it with `python3 scripts/start_searxng.py` from the installed skill root.
- `scripts/start_searxng.py` is the one-command bootstrap path: it installs skill-local Node dependencies and the skill-local Python/SearXNG environment before starting local SearXNG.
- The bundled local settings intentionally use a conservative domestic-first allowlist so local validation stays stable.

Primary environment variables:

- `SEARXNG_BASE_URL`
- `ALLOW_REMOTE_SEARXNG`
- `MAX_RESULTS`
- `MAX_PAGES_TO_FETCH`
- `FETCH_TIMEOUT_MS`
- `FETCH_CONCURRENCY`

## Workflow

1. Identify the research query you need to run.
2. Ensure dependencies are installed and local SearXNG is reachable. If needed, run `python3 scripts/start_searxng.py`.
3. Run `node scripts/free-search.js "<query>"` from the installed skill root.
4. Let the skill discover sources through SearXNG, then fetch the top result pages for body-text extraction when possible.
5. Return the generated markdown report directly unless the user asks for a different presentation layer.

## Output format

Keep this section structure:

- `## Summary`
- `## Key Findings`
- `## Sources`
- `## Caveats`

## Execution contract

- Pass the full research query as a single CLI argument string.
- Read configuration from environment variables.
- Write the final markdown report to stdout on success.
- Write actionable error messages to stderr and exit non-zero on failure.

## Failure handling

- If SearXNG is unavailable, tell the user to confirm the service is running and reachable at `SEARXNG_BASE_URL`.
- If a remote SearXNG host is needed, require explicit opt-in through `ALLOW_REMOTE_SEARXNG=true`.

## Notes

- All commands in this skill are relative to the installed skill root so copy-based and symlink-based installs both work.
- This skill uses SearXNG for discovery, then attempts lightweight fetching of top result pages for fuller summaries.
- Some sites may block automated fetches or return content that cannot be extracted cleanly; in those cases the skill falls back to search-result snippets and should say so in `## Caveats`.
