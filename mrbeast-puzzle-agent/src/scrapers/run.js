#!/usr/bin/env node

/**
 * Scraper runner: collect clues from all sources.
 */

import ora from 'ora';
import chalk from 'chalk';
import { scrapeAllSources, findPuzzleContent } from './webScraper.js';
import { searchReddit, monitorSubreddits, extractCluesFromPosts } from './socialScraper.js';
import { addClue } from '../db/database.js';
import { banner, sectionHeader, info, success, warning, error } from '../utils/display.js';

async function run() {
  banner();
  sectionHeader('SCRAPE RUN');

  // 1. Web sources
  const webSpinner = ora('Scraping known web sources...').start();
  try {
    const webResults = await scrapeAllSources();
    let webFindings = 0;
    for (const result of webResults) {
      if (!result.error) {
        const findings = findPuzzleContent(result);
        webFindings += findings.length;
        for (const f of findings) {
          addClue({
            source: result.name,
            sourceUrl: result.url,
            rawContent: JSON.stringify(f.content || f.matches || f.value).slice(0, 500),
            notes: `Auto-scraped. Type: ${f.type}`,
          });
        }
      }
    }
    webSpinner.succeed(`Web scrape complete: ${webFindings} findings from ${webResults.length} sources`);
  } catch (err) {
    webSpinner.fail(`Web scrape failed: ${err.message}`);
  }

  // 2. Reddit
  const redditSpinner = ora('Searching Reddit...').start();
  try {
    const [searchPosts, monitorPosts] = await Promise.all([
      searchReddit('mrbeast salesforce puzzle solved clue answer'),
      monitorSubreddits(),
    ]);
    const allPosts = [...searchPosts, ...monitorPosts];
    const clues = extractCluesFromPosts(allPosts);
    for (const clue of clues) {
      addClue({
        source: 'reddit',
        sourceUrl: clue.source,
        rawContent: clue.raw,
        decodedContent: clue.extracted,
        confidence: Math.min(0.3 + (clue.postScore || 0) / 100, 0.8),
        notes: `Reddit auto-extract. Score: ${clue.postScore}`,
      });
    }
    redditSpinner.succeed(`Reddit: ${allPosts.length} posts, ${clues.length} extracted clues`);
  } catch (err) {
    redditSpinner.fail(`Reddit scrape failed: ${err.message}`);
  }

  success('Scrape run complete!');
}

run().catch(err => {
  error(err.message);
  process.exit(1);
});
