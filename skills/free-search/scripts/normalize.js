const TRACKING_PARAM_PATTERNS = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^ref$/i, /^source$/i];

export function canonicalizeUrl(input) {
  const url = new URL(input);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();

  const kept = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(key))) {
      continue;
    }
    kept.push([key, value]);
  }

  url.search = '';
  for (const [key, value] of kept) {
    url.searchParams.append(key, value);
  }

  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

function scoreResult(result) {
  return (result.duplicates * 10) - result.firstPosition;
}

export function normalizeResults(results, { maxResults = 10 } = {}) {
  const grouped = new Map();

  results.forEach((result, index) => {
    const canonicalUrl = canonicalizeUrl(result.url);
    const existing = grouped.get(canonicalUrl);

    if (existing) {
      existing.duplicates += 1;
      existing.engines.push(result.engine);
      if (!existing.snippet && result.content) {
        existing.snippet = result.content;
      }
      return;
    }

    grouped.set(canonicalUrl, {
      title: result.title,
      url: canonicalUrl,
      canonicalUrl,
      snippet: result.content ?? '',
      engines: result.engine ? [result.engine] : [],
      duplicates: 1,
      firstPosition: index,
    });
  });

  const ranked = [...grouped.values()].sort((a, b) => scoreResult(b) - scoreResult(a));
  const diversified = [];
  const seenHosts = new Set();
  const overflow = [];

  for (const result of ranked) {
    const host = new URL(result.url).hostname;
    if (!seenHosts.has(host)) {
      seenHosts.add(host);
      diversified.push(result);
    } else {
      overflow.push(result);
    }
  }

  return [...diversified, ...overflow].slice(0, maxResults);
}

export function formatSources(results) {
  return results.map((result, index) => `${index + 1}. [${result.title}](${result.url})`).join('\n');
}
