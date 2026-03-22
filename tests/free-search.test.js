import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import { runFreeSearch } from '../skills/free-search/scripts/free-search.js';

const ENTRYPOINT = new URL('../skills/free-search/scripts/free-search.js', import.meta.url).pathname;

test('runFreeSearch returns the required markdown sections', async () => {
  const output = await runFreeSearch(
    { query: 'claude code', env: { SEARXNG_BASE_URL: 'http://127.0.0.1:12783' } },
    {
      searchWeb: async () => [],
      enrichResultsWithPageContent: async () => []
    }
  );

  assert.match(output, /## Summary/);
  assert.match(output, /## Key Findings/);
  assert.match(output, /## Sources/);
  assert.match(output, /## Caveats/);
});

test('runFreeSearch uses fetched page summaries when available', async () => {
  const output = await runFreeSearch(
    { query: 'claude code', env: { SEARXNG_BASE_URL: 'http://127.0.0.1:12783' } },
    {
      searchWeb: async () => [
        { title: 'Claude Code Docs', url: 'https://example.com/docs', content: 'Search snippet', engine: 'wikipedia' }
      ],
      enrichResultsWithPageContent: async (results) => results.map((result) => ({
        ...result,
        fetched: true,
        pageTitle: 'Claude Code Official Docs',
        bodySummary: 'Claude Code provides an interactive coding agent for repository workflows.'
      }))
    }
  );

  assert.match(output, /Claude Code Official Docs/);
  assert.match(output, /interactive coding agent/);
});

test('runFreeSearch falls back to snippets when page fetches fail', async () => {
  const output = await runFreeSearch(
    { query: 'claude code', env: { SEARXNG_BASE_URL: 'http://127.0.0.1:12783' } },
    {
      searchWeb: async () => [
        { title: 'Claude Code Docs', url: 'https://example.com/docs', content: 'Snippet fallback text', engine: 'wikipedia' }
      ],
      enrichResultsWithPageContent: async (results) => results.map((result) => ({
        ...result,
        fetched: false,
        fetchError: 'timeout'
      }))
    }
  );

  assert.match(output, /Snippet fallback text/);
  assert.match(output, /fell back to search-result snippets/);
});

test('runFreeSearch caveats no longer mention shim mode', async () => {
  const output = await runFreeSearch(
    { query: 'claude code', env: { SEARXNG_BASE_URL: 'http://127.0.0.1:12783' } },
    {
      searchWeb: async () => [],
      enrichResultsWithPageContent: async () => []
    }
  );

  assert.match(output, /## Caveats/);
  assert.doesNotMatch(output, /shim/i);
});

test('CLI failure writes a user-actionable error to stderr and exits non-zero', () => {
  const result = spawnSync('node', [ENTRYPOINT, ''], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.trim(), '');
  assert.match(result.stderr, /query is required/);
});
