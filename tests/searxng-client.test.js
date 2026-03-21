import test from 'node:test';
import assert from 'node:assert/strict';

import { buildConfig, buildSearchUrl, searchSearxng, validateSearxngBaseUrl } from '../skills/free-search/scripts/searxng-client.js';


test('buildConfig uses SearXNG as the default backend', () => {
  const config = buildConfig({});

  assert.equal(config.backend, 'searxng');
  assert.equal(config.baseUrl, 'http://127.0.0.1:8080');
  assert.equal(config.maxResults, 10);
});

test('validateSearxngBaseUrl rejects remote hosts by default', () => {
  assert.throws(
    () => validateSearxngBaseUrl('http://192.168.1.10:8080', false),
    /loopback/
  );
});

test('buildSearchUrl includes json format and query params', () => {
  const url = buildSearchUrl('http://127.0.0.1:8080', {
    query: 'claude code',
    engines: ['google', 'bing'],
    maxResults: 5
  });

  assert.equal(url.origin, 'http://127.0.0.1:8080');
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('q'), 'claude code');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('engines'), 'google,bing');
  assert.equal(url.searchParams.get('count'), '5');
});

test('buildConfig ignores removed shim backend settings', () => {
  const config = buildConfig({
    SEARCH_BACKEND: 'shim',
    SEARCH_SHIM_COMMAND: 'python ./scripts/search_shim.py'
  });

  assert.equal(config.backend, 'searxng');
  assert.equal(config.baseUrl, 'http://127.0.0.1:8080');
  assert.equal(config.maxResults, 10);
  assert.equal(config.shimCommand, undefined);
});

test('searchSearxng sends localhost forwarding headers expected by local SearXNG', async () => {
  let headers;

  await searchSearxng(
    { query: 'claude code', env: { SEARXNG_BASE_URL: 'http://127.0.0.1:8080' } },
    async (_url, options) => {
      headers = options.headers;
      return {
        ok: true,
        json: async () => ({ results: [] })
      };
    }
  );

  assert.equal(headers['X-Forwarded-For'], '127.0.0.1');
  assert.equal(headers['X-Real-IP'], '127.0.0.1');
});

test('searchSearxng returns a clearer local-service error when the local instance is unreachable', async () => {
  await assert.rejects(
    () => searchSearxng({ query: 'claude code', env: { SEARXNG_BASE_URL: 'http://127.0.0.1:65535' } }),
    /Unable to reach local SearXNG.*127.0.0.1:65535/
  );
});

test('searchSearxng aborts requests after the configured search timeout', async () => {
  await assert.rejects(
    () => searchSearxng(
      {
        query: 'claude code',
        env: {
          SEARXNG_BASE_URL: 'http://127.0.0.1:8080',
          SEARCH_TIMEOUT_MS: '10'
        }
      },
      (_url, options) => new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('timed out')));
      })
    ),
    /timed out/
  );
});

