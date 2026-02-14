/**
 * Web scraper for gathering puzzle clues from various sources.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (compatible; PuzzleAgent/1.0)';

const KNOWN_SOURCES = [
  { name: 'mrbeast-salesforce-main', url: 'https://mrbeast.salesforce.com/' },
  { name: 'mrbeast-salesforce-how', url: 'https://mrbeast.salesforce.com/how' },
  { name: 'mrbeast-salesforce-faq', url: 'https://mrbeast.salesforce.com/faq' },
  { name: 'mrbeast-salesforce-terms', url: 'https://mrbeast.salesforce.com/terms' },
];

/**
 * Fetch and parse a webpage
 */
export async function fetchPage(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 15000,
    });
    const $ = cheerio.load(response.data);
    return {
      url,
      status: response.status,
      title: $('title').text(),
      html: response.data,
      text: $('body').text().trim(),
      links: extractLinks($, url),
      images: extractImages($, url),
      meta: extractMeta($),
      scripts: extractScriptContent($),
      hiddenElements: extractHiddenContent($),
    };
  } catch (error) {
    return { url, error: error.message, status: error.response?.status };
  }
}

function extractLinks($, baseUrl) {
  const links = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    try {
      const resolved = new URL(href, baseUrl).href;
      links.push({ url: resolved, text, raw: href });
    } catch {
      links.push({ url: href, text, raw: href });
    }
  });
  return links;
}

function extractImages($, baseUrl) {
  const images = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    const alt = $(el).attr('alt') || '';
    const title = $(el).attr('title') || '';
    try {
      const resolved = new URL(src, baseUrl).href;
      images.push({ url: resolved, alt, title, raw: src });
    } catch {
      images.push({ url: src, alt, title, raw: src });
    }
  });
  return images;
}

function extractMeta($) {
  const meta = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || '';
    const content = $(el).attr('content') || '';
    if (name && content) meta[name] = content;
  });
  return meta;
}

function extractScriptContent($) {
  const scripts = [];
  $('script').each((_, el) => {
    const content = $(el).html();
    if (content && content.length > 10) {
      // Look for embedded data, JSON, or suspicious strings
      const jsonMatches = content.match(/\{[^}]{20,}\}/g);
      const urlMatches = content.match(/https?:\/\/[^\s"']+/g);
      const suspiciousStrings = content.match(/(?:key|secret|code|puzzle|clue|answer|vault|beast)[^\n;]{0,100}/gi);
      scripts.push({
        length: content.length,
        jsonData: jsonMatches?.slice(0, 5),
        urls: urlMatches?.slice(0, 10),
        suspicious: suspiciousStrings?.slice(0, 10),
      });
    }
  });
  return scripts;
}

function extractHiddenContent($) {
  const hidden = [];
  // Check for hidden elements, comments, data attributes
  $('[style*="display:none"], [style*="display: none"], [hidden], .hidden').each((_, el) => {
    const text = $(el).text().trim();
    if (text) hidden.push({ type: 'hidden-element', content: text });
  });

  // Extract HTML comments
  const html = $.html();
  const commentRegex = /<!--([\s\S]*?)-->/g;
  let match;
  while ((match = commentRegex.exec(html)) !== null) {
    const comment = match[1].trim();
    if (comment.length > 5 && !comment.includes('[if')) {
      hidden.push({ type: 'comment', content: comment });
    }
  }

  // Data attributes that might hold clues
  $('[data-clue], [data-puzzle], [data-secret], [data-code], [data-answer]').each((_, el) => {
    const attrs = {};
    for (const attr of el.attributes || []) {
      if (attr.name.startsWith('data-')) attrs[attr.name] = attr.value;
    }
    hidden.push({ type: 'data-attribute', content: JSON.stringify(attrs) });
  });

  return hidden;
}

/**
 * Scrape all known puzzle sources
 */
export async function scrapeAllSources() {
  const results = [];
  for (const source of KNOWN_SOURCES) {
    console.log(`Scraping: ${source.name} (${source.url})`);
    const page = await fetchPage(source.url);
    results.push({ ...source, ...page });
  }
  return results;
}

/**
 * Search for puzzle-related content in scraped page data
 */
export function findPuzzleContent(pageData) {
  const findings = [];
  const puzzleKeywords = [
    'clue', 'puzzle', 'cipher', 'code', 'secret', 'hidden', 'vault',
    'endgame', 'beast', 'island', 'key', 'lock', 'solve', 'answer',
    'hint', 'riddle', 'decode', 'encrypt', 'mystery'
  ];

  // Search text content
  const text = pageData.text?.toLowerCase() || '';
  for (const keyword of puzzleKeywords) {
    const regex = new RegExp(`[^.]*\\b${keyword}\\b[^.]*\\.`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      findings.push({ type: 'text', keyword, matches: matches.slice(0, 5) });
    }
  }

  // Search hidden content
  for (const hidden of pageData.hiddenElements || []) {
    findings.push({ type: 'hidden', content: hidden });
  }

  // Suspicious script content
  for (const script of pageData.scripts || []) {
    if (script.suspicious?.length > 0) {
      findings.push({ type: 'script', content: script });
    }
  }

  // Look for numbers that match known puzzle numbers
  const knownNumbers = ['3634826', '108', '27', '42', '4815162342'];
  for (const num of knownNumbers) {
    if (text.includes(num)) {
      findings.push({ type: 'number', value: num, context: 'Found in page text' });
    }
  }

  return findings;
}
