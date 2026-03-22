import { formatSources, normalizeResults } from './normalize.js';
import { enrichResultsWithPageContent } from './page-content.js';
import { buildConfig, searchWeb } from './searxng-client.js';

function buildSummary(query, normalized, enriched) {
  if (normalized.length === 0) {
    return `No results were found for “${query}”.`;
  }

  const fetchedCount = enriched.filter((item) => item.fetched).length;
  const top = enriched.find((item) => item.fetched) ?? normalized[0];
  return `For “${query}”, ${normalized.length} candidate sources were consolidated. Full page content was retrieved for ${fetchedCount} of the top ${Math.min(enriched.length, 3)} sources. The strongest source in the final report is ${top.pageTitle || top.title}.`;
}

function buildFindings(enriched) {
  return enriched.slice(0, 3).map((item) => {
    const detail = item.bodySummary || item.snippet || 'No detailed content could be extracted.';
    return `- ${item.pageTitle || item.title}: ${detail}`;
  }).join('\n');
}

function buildCaveats(enriched, maxPagesToFetch) {
  const fetchedCount = enriched.filter((item) => item.fetched).length;
  const attempted = Math.min(maxPagesToFetch, enriched.length);
  const failures = enriched
    .slice(0, attempted)
    .filter((item) => item.fetchError)
    .map((item) => `${item.title} (${item.fetchError})`);

  const caveats = [
    `- This output uses local SearXNG for discovery and fetched full page content for ${fetchedCount} of ${attempted} top sources.`
  ];

  if (failures.length > 0) {
    caveats.push(`- Some pages could not be fully analyzed and fell back to search-result snippets: ${failures.join('; ')}.`);
  }

  return caveats.join('\n');
}

export async function runFreeSearch({ query, env = process.env } = {}, dependencies = {}) {
  if (!query) {
    throw new Error('query is required');
  }

  const config = buildConfig(env);
  const search = dependencies.searchWeb ?? searchWeb;
  const enrich = dependencies.enrichResultsWithPageContent ?? enrichResultsWithPageContent;
  const rawResults = await search({ query, maxResults: config.maxResults, env });
  const normalized = normalizeResults(rawResults, { maxResults: config.maxResults });
  const enriched = await enrich(normalized, {
    query,
    maxPages: config.maxPagesToFetch,
    concurrency: config.fetchConcurrency,
    timeoutMs: config.fetchTimeoutMs,
    fetchImpl: dependencies.fetchImpl,
  });

  const sections = [
    '## Summary',
    buildSummary(query, normalized, enriched),
    '',
    '## Key Findings',
    buildFindings(enriched) || '- No findings available',
    '',
    '## Sources',
    formatSources(normalized) || 'No sources',
    '',
    '## Caveats',
    buildCaveats(enriched, config.maxPagesToFetch)
  ];

  return sections.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const query = process.argv.slice(2).join(' ').trim();
  runFreeSearch({ query })
    .then((output) => {
      console.log(output);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
