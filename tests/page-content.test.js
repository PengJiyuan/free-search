import test from 'node:test';
import assert from 'node:assert/strict';

import { enrichResultsWithPageContent, extractPageContent, fetchPageContent } from '../skills/free-search/scripts/page-content.js';

test('extractPageContent removes obvious html noise and preserves readable text', () => {
  const result = extractPageContent(`
    <html>
      <head><title>Example Page</title><style>.x { color: red; }</style></head>
      <body>
        <nav>Navigation</nav>
        <main>
          <h1>Important heading</h1>
          <p>The first useful paragraph explains the main topic in detail.</p>
        </main>
        <script>console.log('ignore me')</script>
      </body>
    </html>
  `);

  assert.equal(result.title, 'Example Page');
  assert.match(result.text, /Important heading/);
  assert.match(result.text, /main topic in detail/);
  assert.doesNotMatch(result.text, /Navigation/);
  assert.doesNotMatch(result.text, /ignore me/);
});

test('extractPageContent prefers article content over boilerplate blocks', () => {
  const result = extractPageContent(`
    <html>
      <head><title>Article Page</title></head>
      <body>
        <header>Site menu and navigation</header>
        <div class="cookie-banner">Please accept cookies</div>
        <article>
          <h1>Detailed story title</h1>
          <p>This article paragraph contains the main detailed explanation of the topic with enough substance.</p>
          <p>A second article paragraph adds extra evidence and discussion for the summary.</p>
        </article>
        <section class="related-links">Related links and share buttons</section>
      </body>
    </html>
  `);

  assert.match(result.text, /Detailed story title/);
  assert.match(result.text, /main detailed explanation/);
  assert.doesNotMatch(result.text, /accept cookies/i);
  assert.doesNotMatch(result.text, /related links/i);
});

test('fetchPageContent returns structured failure for non-html responses', async () => {
  const result = await fetchPageContent('https://example.com/data.json', {
    query: 'claude code',
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => '{}'
    })
  });

  assert.equal(result.fetched, false);
  assert.equal(result.fetchError, 'non-html content');
});

test('fetchPageContent extracts page text and summary from html responses', async () => {
  const result = await fetchPageContent('https://example.com/page', {
    query: 'claude code',
    fetchImpl: async () => ({
      ok: true,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => `
        <html>
          <head><title>Claude Code Guide</title></head>
          <body>
            <article>
              <p>Claude Code helps developers inspect, edit, and test code from the terminal.</p>
              <p>The tool is designed for repository workflows and iterative coding tasks.</p>
            </article>
          </body>
        </html>
      `
    })
  });

  assert.equal(result.fetched, true);
  assert.equal(result.pageTitle, 'Claude Code Guide');
  assert.match(result.bodyText, /repository workflows/);
  assert.match(result.bodySummary, /Claude Code helps developers/);
});

test('enrichResultsWithPageContent only fetches up to the configured page limit', async () => {
  const visited = [];
  const results = [
    { title: 'One', url: 'https://example.com/1', snippet: 'one' },
    { title: 'Two', url: 'https://example.com/2', snippet: 'two' },
    { title: 'Three', url: 'https://example.com/3', snippet: 'three' }
  ];

  const enriched = await enrichResultsWithPageContent(results, {
    query: 'claude code',
    maxPages: 2,
    fetchImpl: async (url) => {
      visited.push(url);
      return {
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => '<html><body><p>Fetched body content for testing.</p></body></html>'
      };
    }
  });

  assert.equal(visited.length, 2);
  assert.equal(enriched[0].fetched, true);
  assert.equal(enriched[1].fetched, true);
  assert.equal(enriched[2].fetched, undefined);
});
