/**
 * Social media and community scraper for puzzle clues.
 * Scrapes publicly available information from Reddit, Twitter, etc.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (compatible; PuzzleAgent/1.0)';

/**
 * Search Reddit for MrBeast puzzle discussions
 */
export async function searchReddit(query = 'mrbeast salesforce puzzle clue') {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=25`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });
    const posts = response.data?.data?.children || [];
    return posts.map(post => ({
      title: post.data.title,
      subreddit: post.data.subreddit,
      url: `https://reddit.com${post.data.permalink}`,
      selftext: post.data.selftext?.slice(0, 1000),
      score: post.data.score,
      numComments: post.data.num_comments,
      created: new Date(post.data.created_utc * 1000).toISOString(),
    }));
  } catch (error) {
    console.error('Reddit search failed:', error.message);
    return [];
  }
}

/**
 * Fetch a Reddit thread's comments for clue analysis
 */
export async function fetchRedditThread(threadUrl) {
  try {
    const jsonUrl = threadUrl.replace(/\/?$/, '.json');
    const response = await axios.get(jsonUrl, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });
    const data = response.data;
    if (!Array.isArray(data) || data.length < 2) return [];

    const comments = [];
    function extractComments(node) {
      if (!node?.data) return;
      if (node.data.body) {
        comments.push({
          author: node.data.author,
          body: node.data.body.slice(0, 2000),
          score: node.data.score,
          created: new Date(node.data.created_utc * 1000).toISOString(),
        });
      }
      if (node.data.replies?.data?.children) {
        for (const child of node.data.replies.data.children) {
          extractComments(child);
        }
      }
    }

    for (const child of data[1].data.children) {
      extractComments(child);
    }

    return comments.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('Reddit thread fetch failed:', error.message);
    return [];
  }
}

/**
 * Extract potential clues from social media posts
 */
export function extractCluesFromPosts(posts) {
  const cluePatterns = [
    /clue[:\s]+(.+)/gi,
    /answer[:\s]+(.+)/gi,
    /decode[ds]?[:\s]+(.+)/gi,
    /puzzle\s*#?\d+[:\s]+(.+)/gi,
    /found[:\s]+(.+)/gi,
    /solution[:\s]+(.+)/gi,
    /the\s+word\s+is\s+"?(\w+)"?/gi,
    /=\s*"?([A-Z]{3,})"?/g,
  ];

  const clues = [];
  for (const post of posts) {
    const text = `${post.title || ''} ${post.selftext || ''} ${post.body || ''}`;
    for (const pattern of cluePatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        clues.push({
          source: post.url || 'social',
          raw: match[0],
          extracted: match[1]?.trim(),
          context: text.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100),
          postScore: post.score,
        });
      }
    }
  }

  return clues;
}

/**
 * Monitor key subreddits for new puzzle findings
 */
export async function monitorSubreddits() {
  const subreddits = [
    'mrbeast',
    'puzzles',
    'ARG',
    'codes',
  ];

  const allPosts = [];
  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/new.json?limit=10`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000,
      });
      const posts = response.data?.data?.children || [];
      const relevant = posts
        .filter(p => {
          const text = `${p.data.title} ${p.data.selftext}`.toLowerCase();
          return text.includes('mrbeast') || text.includes('salesforce') ||
                 text.includes('puzzle') || text.includes('million');
        })
        .map(p => ({
          subreddit: sub,
          title: p.data.title,
          url: `https://reddit.com${p.data.permalink}`,
          selftext: p.data.selftext?.slice(0, 1000),
          score: p.data.score,
          created: new Date(p.data.created_utc * 1000).toISOString(),
        }));
      allPosts.push(...relevant);
    } catch (error) {
      console.error(`Failed to fetch r/${sub}:`, error.message);
    }
  }

  return allPosts;
}
