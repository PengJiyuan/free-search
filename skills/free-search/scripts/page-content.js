import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function htmlToBlocks(html) {
  return decodeHtmlEntities(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|main|li|h1|h2|h3|h4|h5|h6|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map((block) => collapseWhitespace(block))
    .filter(Boolean);
}

export function extractPageContent(html, { url = 'https://example.com/', maxChars = 12000 } = {}) {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article?.textContent) {
    return {
      title: '',
      text: '',
      blocks: [],
    };
  }

  const text = collapseWhitespace(article.textContent).slice(0, maxChars);
  const blocks = htmlToBlocks(article.content).filter((block) => block.length > 20);

  return {
    title: collapseWhitespace(article.title || ''),
    text,
    blocks,
  };
}

function summarizeText(text, query, blocks = []) {
  if (!text) {
    return '';
  }

  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);

  const candidates = (blocks.length > 0 ? blocks : text.split(/(?<=[.!?。！？])\s+/))
    .flatMap((block) => block.split(/(?<=[.!?。！？])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40);

  if (candidates.length === 0) {
    return text.slice(0, 280);
  }

  const ranked = [...candidates].sort((a, b) => {
    const aScore = queryTerms.reduce((score, term) => score + (a.toLowerCase().includes(term) ? 1 : 0), 0);
    const bScore = queryTerms.reduce((score, term) => score + (b.toLowerCase().includes(term) ? 1 : 0), 0);
    return bScore - aScore;
  });

  return ranked.slice(0, 2).join(' ');
}

function normalizeFetchError(error) {
  if (error?.name === 'AbortError') {
    return 'timeout';
  }

  return error?.message || 'fetch failed';
}

export async function fetchPageContent(url, { query, timeoutMs = 10000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        'user-agent': 'free-search-skill/0.1',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        fetched: false,
        fetchError: `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return {
        fetched: false,
        fetchError: 'non-html content',
      };
    }

    const html = await response.text();
    const extracted = extractPageContent(html, { url });
    const summary = summarizeText(extracted.text, query, extracted.blocks);

    if (!extracted.text) {
      return {
        fetched: false,
        fetchError: 'empty page content',
      };
    }

    return {
      fetched: true,
      pageTitle: extracted.title,
      bodyText: extracted.text,
      bodySummary: summary,
    };
  } catch (error) {
    return {
      fetched: false,
      fetchError: normalizeFetchError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichResultsWithPageContent(results, { query, maxPages = 3, concurrency = 3, timeoutMs = 10000, fetchImpl = fetch } = {}) {
  const limitedResults = results.slice(0, maxPages);
  const enriched = [...results];
  let index = 0;

  async function worker() {
    while (index < limitedResults.length) {
      const current = index;
      index += 1;
      const result = limitedResults[current];
      enriched[current] = {
        ...result,
        ...(await fetchPageContent(result.url, { query, timeoutMs, fetchImpl }))
      };
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, limitedResults.length || 1) }, worker));
  return enriched;
}
