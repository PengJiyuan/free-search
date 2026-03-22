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

function removeGlobalNoise(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ');
}

function extractMetaTitle(html) {
  const metaMatch = html.match(/<meta[^>]+(?:property|name)=["'](?:og:title|twitter:title)["'][^>]+content=["']([^"']+)["']/i);
  if (metaMatch) {
    return collapseWhitespace(decodeHtmlEntities(metaMatch[1]));
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? collapseWhitespace(decodeHtmlEntities(titleMatch[1])) : '';
}

function extractPreferredRegion(html) {
  const preferredPatterns = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<(?:section|div)\b[^>]*(?:id|class)=["'][^"']*(?:content|article|post|entry|main|body)[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div)>/i,
    /<body\b[^>]*>([\s\S]*?)<\/body>/i,
  ];

  for (const pattern of preferredPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return html;
}

function stripBlockNoise(html) {
  return html
    .replace(/<(?:header|footer|nav|aside|form|dialog)\b[^>]*>[\s\S]*?<\/(?:header|footer|nav|aside|form|dialog)>/gi, ' ')
    .replace(/<(?:section|div)\b[^>]*(?:id|class)=["'][^"']*(?:comment|share|cookie|related|recommend|newsletter|sidebar|breadcrumb|menu|social)[^"']*["'][^>]*>[\s\S]*?<\/(?:section|div)>/gi, ' ');
}

function htmlToBlocks(html) {
  const blockified = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|main|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeHtmlEntities(blockified)
    .split(/\n+/)
    .map((block) => collapseWhitespace(block))
    .filter(Boolean);
}

function isLikelyBoilerplate(block) {
  if (block.length < 35) {
    return true;
  }

  const lower = block.toLowerCase();
  if (/(cookie|privacy|subscribe|sign in|log in|share|comment|related|all rights reserved)/.test(lower)) {
    return true;
  }

  const linkWords = (block.match(/\b(?:home|about|contact|terms|login|signup|menu)\b/gi) || []).length;
  return linkWords >= 3;
}

function scoreBlock(block, queryTerms) {
  const sentences = (block.match(/[.!?。！？]/g) || []).length;
  const queryHits = queryTerms.reduce((score, term) => score + (block.toLowerCase().includes(term) ? 1 : 0), 0);
  return (Math.min(block.length, 400) / 80) + (sentences * 2) + (queryHits * 3);
}

function selectContentBlocks(blocks, queryTerms) {
  return blocks
    .filter((block) => !isLikelyBoilerplate(block))
    .map((block) => ({ block, score: scoreBlock(block, queryTerms) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ block }) => block);
}

export function extractPageContent(html, { maxChars = 12000 } = {}) {
  const cleanedHtml = removeGlobalNoise(html);
  const title = extractMetaTitle(cleanedHtml);
  const preferredRegion = extractPreferredRegion(cleanedHtml);
  const contentRegion = stripBlockNoise(preferredRegion);
  const blocks = htmlToBlocks(contentRegion);
  const text = blocks.join('\n').slice(0, maxChars);

  return {
    title,
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

  const candidateBlocks = (blocks.length > 0 ? selectContentBlocks(blocks, queryTerms) : [])
    .flatMap((block) => block.split(/(?<=[.!?。！？])\s+/))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40);

  const sentences = (candidateBlocks.length > 0 ? candidateBlocks : text
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim()))
    .filter((sentence) => sentence.length > 40);

  if (sentences.length === 0) {
    return text.slice(0, 280);
  }

  const ranked = [...sentences].sort((a, b) => {
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
    const extracted = extractPageContent(html);
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
