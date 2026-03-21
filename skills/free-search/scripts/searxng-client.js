const DEFAULTS = {
  baseUrl: 'http://127.0.0.1:8080',
  allowRemote: false,
  searchTimeoutMs: 8000,
  fetchTimeoutMs: 10000,
  maxResults: 10,
  maxPagesToFetch: 3,
  fetchConcurrency: 3,
};

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  return value === 'true' || value === true;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildConfig(env = process.env) {
  return {
    backend: 'searxng',
    baseUrl: env.SEARXNG_BASE_URL ?? DEFAULTS.baseUrl,
    allowRemote: parseBoolean(env.ALLOW_REMOTE_SEARXNG, DEFAULTS.allowRemote),
    searchTimeoutMs: parseNumber(env.SEARCH_TIMEOUT_MS, DEFAULTS.searchTimeoutMs),
    fetchTimeoutMs: parseNumber(env.FETCH_TIMEOUT_MS, DEFAULTS.fetchTimeoutMs),
    maxResults: parseNumber(env.MAX_RESULTS, DEFAULTS.maxResults),
    maxPagesToFetch: parseNumber(env.MAX_PAGES_TO_FETCH, DEFAULTS.maxPagesToFetch),
    fetchConcurrency: parseNumber(env.FETCH_CONCURRENCY, DEFAULTS.fetchConcurrency),
  };
}

export function validateSearxngBaseUrl(baseUrl, allowRemote = false) {
  const url = new URL(baseUrl);
  const isLoopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);

  if (!allowRemote && !isLoopback) {
    throw new Error('SearXNG base URL must be a loopback address unless remote access is explicitly enabled.');
  }

  return url;
}

export function buildSearchUrl(baseUrl, { query, engines = [], maxResults = 10 } = {}) {
  const url = new URL('/search', validateSearxngBaseUrl(baseUrl, true));
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('count', String(maxResults));

  if (engines.length > 0) {
    url.searchParams.set('engines', engines.join(','));
  }

  return url;
}

export async function searchSearxng(options, fetchImpl = fetch) {
  const config = buildConfig(options.env);
  const baseUrl = validateSearxngBaseUrl(config.baseUrl, config.allowRemote).toString();
  const searchUrl = buildSearchUrl(baseUrl, {
    query: options.query,
    engines: options.engines ?? [],
    maxResults: options.maxResults ?? config.maxResults,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.searchTimeoutMs);

  try {
    const response = await fetchImpl(searchUrl, {
      headers: {
        'user-agent': 'free-search-skill/0.1',
        accept: 'application/json',
        'X-Forwarded-For': '127.0.0.1',
        'X-Real-IP': '127.0.0.1',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SearXNG request failed with status ${response.status}`);
    }

    const payload = await response.json();
    return payload.results ?? [];
  } catch (error) {
    if (error?.cause?.code === 'ECONNREFUSED' || /fetch failed|ECONNREFUSED|connect/i.test(error.message)) {
      throw new Error(`Unable to reach local SearXNG at ${baseUrl}. Please confirm the service is running and reachable.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchWeb(options, fetchImpl = fetch) {
  const config = buildConfig(options.env);
  const maxResults = options.maxResults ?? config.maxResults;

  return searchSearxng({ ...options, maxResults }, fetchImpl);
}
