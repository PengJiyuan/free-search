# free-search

A Claude Code skill for web research using a local SearXNG service instead of paid search APIs.

## What it does

- uses local SearXNG as the supported search backend
- deduplicates overlapping results
- fetches the top discovered pages and extracts article-style body text with Mozilla Readability when available
- outputs a structured research summary with sources and caveats

## Repository layout

```text
skills/free-search/
  SKILL.md
  scripts/
    free-search.js
    normalize.js
    searxng-client.js
    start_searxng.py
    searxng.settings.yml

tests/
  free-search.test.js
  normalize.test.js
  searxng-client.test.js
  start-searxng.test.js
```

`skills/free-search/` is the canonical GitHub source for the skill.
`.claude/` is not a source-of-truth path in this repository; it is only the local install destination if you copy or symlink the skill into Claude Code.

## Prerequisites

- Node.js with ESM support
- Python 3
- a local SearXNG instance, or an explicitly approved remote SearXNG instance

Primary environment variables:

- `SEARXNG_BASE_URL` defaults to `http://127.0.0.1:12783`
- `ALLOW_REMOTE_SEARXNG=true` allows non-loopback SearXNG hosts
- `MAX_RESULTS` controls how many normalized results are kept
- `MAX_PAGES_TO_FETCH` controls how many top pages are fetched for body extraction
- `FETCH_TIMEOUT_MS` controls the timeout for each page fetch
- `FETCH_CONCURRENCY` controls how many page fetches run in parallel

## Start local SearXNG

Start local SearXNG with the helper script:

```bash
python3 skills/free-search/scripts/start_searxng.py
```

This installs skill-local Node dependencies if needed, prepares a skill-local virtual environment, and starts SearXNG on `http://127.0.0.1:12783` by default.
The bundled local settings also use a conservative domestic-first allowlist so local validation stays stable.

Useful helper modes:

```bash
python3 skills/free-search/scripts/start_searxng.py --prepare-only
python3 skills/free-search/scripts/start_searxng.py --print-install-command
python3 skills/free-search/scripts/start_searxng.py --print-start-command
```

## Install into Claude Code locally

Copy or symlink the skill directory into your local Claude skill directory:

```text
skills/free-search/ -> .claude/skills/free-search/
```

Because all commands in `SKILL.md` are relative to the installed skill root, both copy-based and symlink-based installs work.

## Run the skill directly

With SearXNG running, invoke the skill entrypoint directly:

```bash
node skills/free-search/scripts/free-search.js "What is SearXNG"
```

You can also point it at a different allowed endpoint:

```bash
SEARXNG_BASE_URL=http://127.0.0.1:12783 node skills/free-search/scripts/free-search.js "What is SearXNG"
```

If the service is unreachable, the script returns a clear error telling you to confirm SearXNG is running and reachable.

## Run tests

```bash
npm test
```

## Limitations

- This skill relies on local SearXNG for discovery and lightweight HTML fetching for top-result enrichment.
- Some pages may block automated fetching, time out, or return non-HTML content, in which case the output falls back to search-result snippets.
- It is intentionally focused on local, low-cost research workflows rather than multi-provider orchestration or browser automation.
