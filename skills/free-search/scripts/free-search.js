import { formatSources, normalizeResults } from './normalize.js';
import { buildConfig, searchWeb } from './searxng-client.js';

function buildSummary(query, normalized) {
  if (normalized.length === 0) {
    return `No results were found for “${query}”.`;
  }

  const top = normalized[0];
  return `For “${query}”, ${normalized.length} candidate sources were consolidated. The highest-priority source is ${top.title}.`;
}

function buildFindings(normalized) {
  return normalized.slice(0, 3).map((item) => `- ${item.title} (${item.engines.join(', ') || 'unknown'})`).join('\n');
}

export async function runFreeSearch({ query, env = process.env } = {}, dependencies = {}) {
  if (!query) {
    throw new Error('query is required');
  }

  const config = buildConfig(env);
  const search = dependencies.searchWeb ?? searchWeb;
  const rawResults = await search({ query, maxResults: config.maxResults, env });
  const normalized = normalizeResults(rawResults, { maxResults: config.maxResults });

  const sections = [
    '## Summary',
    buildSummary(query, normalized),
    '',
    '## Key Findings',
    buildFindings(normalized) || '- No findings available',
    '',
    '## Sources',
    formatSources(normalized) || 'No sources',
    '',
    '## Caveats',
    '- This output is based on local SearXNG search result summaries and does not fetch full page content.'
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
