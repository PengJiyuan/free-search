import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalizeUrl, normalizeResults } from '../skills/free-search/scripts/normalize.js';

test('canonicalizeUrl strips tracking params and fragments', () => {
  const actual = canonicalizeUrl('https://Example.com/docs/?utm_source=x&gclid=123&id=42#intro');
  assert.equal(actual, 'https://example.com/docs?id=42');
});

test('normalizeResults deduplicates results by canonical URL and aggregates engines', () => {
  const results = [
    {
      title: 'SearXNG Docs',
      url: 'https://docs.example.com/start?utm_source=a',
      content: 'First snippet',
      engine: 'google'
    },
    {
      title: 'SearXNG Docs',
      url: 'https://docs.example.com/start',
      content: 'Second snippet',
      engine: 'bing'
    },
    {
      title: 'Another page',
      url: 'https://blog.example.com/post',
      content: 'Third snippet',
      engine: 'duckduckgo'
    }
  ];

  const actual = normalizeResults(results, { maxResults: 10 });

  assert.equal(actual.length, 2);
  assert.deepEqual(actual[0].engines.sort(), ['bing', 'google']);
  assert.equal(actual[0].duplicates, 2);
});

test('normalizeResults prefers domain diversity after ranking', () => {
  const results = [
    {
      title: 'A1',
      url: 'https://a.example.com/1',
      content: 'A1',
      engine: 'google'
    },
    {
      title: 'A2',
      url: 'https://a.example.com/2',
      content: 'A2',
      engine: 'bing'
    },
    {
      title: 'B1',
      url: 'https://b.example.com/1',
      content: 'B1',
      engine: 'duckduckgo'
    }
  ];

  const actual = normalizeResults(results, { maxResults: 3 });

  assert.equal(new URL(actual[0].url).hostname, 'a.example.com');
  assert.equal(new URL(actual[1].url).hostname, 'b.example.com');
});
