const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'PersonalPodcast/1.0'
  }
});

const DATA_DIR = path.join(__dirname, 'data');
const EPISODES_DIR = path.join(DATA_DIR, 'episodes');
const EPISODES_FILE = path.join(DATA_DIR, 'episodes.json');
const FEEDS_FILE = path.join(DATA_DIR, 'feeds.json');
const CACHE_FILE = path.join(DATA_DIR, 'cache.json');
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Podcast metadata
const PODCAST_TITLE = 'My Podcast';
const PODCAST_DESCRIPTION = 'Your personal daily briefing — fiction trends, Clemson sports, tech, and La Liga.';
const PODCAST_AUTHOR = 'My Podcast';
const PODCAST_LANGUAGE = 'en';
const TTS_VOICE = 'en-US-AndrewMultilingualNeural';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(EPISODES_DIR)) {
  fs.mkdirSync(EPISODES_DIR);
}
if (!fs.existsSync(EPISODES_FILE)) {
  fs.writeFileSync(EPISODES_FILE, JSON.stringify({ episodes: [] }, null, 2));
}

// Default feed sources organized by interest
const DEFAULT_FEEDS = {
  categories: [
    {
      id: 'fiction',
      name: 'Fiction Trends',
      icon: '📚',
      color: '#8B5CF6',
      feeds: [
        { url: 'https://lithub.com/feed/', name: 'Literary Hub' },
        { url: 'https://www.tor.com/feed/', name: 'Tor.com' },
        { url: 'https://bookriot.com/feed/', name: 'Book Riot' },
        { url: 'https://electricliterature.com/feed/', name: 'Electric Literature' }
      ]
    },
    {
      id: 'clemson',
      name: 'Clemson Sports',
      icon: '🐅',
      color: '#F97316',
      feeds: [
        { url: 'https://www.tigernet.com/rss/story.xml', name: 'TigerNet' },
        { url: 'https://clemsontigers.com/feed/', name: 'Clemson Tigers Official' },
        { url: 'https://247sports.com/college/clemson/ContentPage/RSS-Feed-148498/', name: '247Sports Clemson' }
      ]
    },
    {
      id: 'tech',
      name: 'Tech',
      icon: '💻',
      color: '#06B6D4',
      feeds: [
        { url: 'https://hnrss.org/frontpage', name: 'Hacker News' },
        { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', name: 'Ars Technica' },
        { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge' },
        { url: 'https://techcrunch.com/feed/', name: 'TechCrunch' }
      ]
    },
    {
      id: 'laliga',
      name: 'La Liga',
      icon: '⚽',
      color: '#EF4444',
      feeds: [
        { url: 'https://www.marca.com/en/rss/football.xml', name: 'Marca Football' },
        { url: 'https://as.com/rss/tags/la_liga.xml', name: 'AS La Liga' },
        { url: 'https://footballespana.net/feed', name: 'Football Espana' },
        { url: 'https://barcablaugranes.com/rss/current', name: 'Barca Blaugranes' }
      ]
    }
  ]
};

// Initialize feeds config if it doesn't exist
if (!fs.existsSync(FEEDS_FILE)) {
  fs.writeFileSync(FEEDS_FILE, JSON.stringify(DEFAULT_FEEDS, null, 2));
}

function readFeeds() {
  return JSON.parse(fs.readFileSync(FEEDS_FILE, 'utf8'));
}

function writeFeeds(data) {
  fs.writeFileSync(FEEDS_FILE, JSON.stringify(data, null, 2));
}

function readCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

// Fetch a single RSS feed with caching
async function fetchFeed(feedUrl, feedName, categoryId) {
  const cache = readCache();
  const cacheKey = feedUrl;
  const now = Date.now();

  if (cache[cacheKey] && (now - cache[cacheKey].fetchedAt) < CACHE_TTL) {
    return cache[cacheKey].items;
  }

  try {
    const feed = await parser.parseURL(feedUrl);
    const items = (feed.items || []).slice(0, 10).map(item => ({
      title: item.title || 'Untitled',
      link: item.link || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      snippet: stripHtml(item.contentSnippet || item.content || item.summary || '').slice(0, 300),
      source: feedName,
      categoryId,
      image: extractImage(item)
    }));

    cache[cacheKey] = { items, fetchedAt: now };
    writeCache(cache);
    return items;
  } catch (err) {
    console.error(`Failed to fetch ${feedName} (${feedUrl}): ${err.message}`);
    // Return cached data even if stale
    if (cache[cacheKey]) return cache[cacheKey].items;
    return [];
  }
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractImage(item) {
  // Try various common RSS image fields
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
    return item['media:content']['$'].url;
  }
  // Try to extract from content
  const content = item.content || item['content:encoded'] || '';
  const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
  if (imgMatch) return imgMatch[1];
  return null;
}

// API Routes

// Get all categories
app.get('/api/categories', (req, res) => {
  const data = readFeeds();
  const categories = data.categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    feedCount: c.feeds.length
  }));
  res.json(categories);
});

// Get all categories with full feed details
app.get('/api/categories/full', (req, res) => {
  const data = readFeeds();
  res.json(data.categories);
});

// Get feed items for a category (or all)
app.get('/api/feed', async (req, res) => {
  const { category } = req.query;
  const data = readFeeds();

  let categoriesToFetch = data.categories;
  if (category && category !== 'all') {
    categoriesToFetch = data.categories.filter(c => c.id === category);
  }

  const allItems = [];
  const fetchPromises = [];

  for (const cat of categoriesToFetch) {
    for (const feed of cat.feeds) {
      fetchPromises.push(
        fetchFeed(feed.url, feed.name, cat.id).then(items => {
          allItems.push(...items);
        })
      );
    }
  }

  await Promise.allSettled(fetchPromises);

  // Sort by date, newest first
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  res.json(allItems);
});

// Add a new feed to a category
app.post('/api/categories/:categoryId/feeds', (req, res) => {
  const { categoryId } = req.params;
  const { url, name } = req.body;

  if (!url || !name) {
    return res.status(400).json({ error: 'URL and name are required' });
  }

  const data = readFeeds();
  const category = data.categories.find(c => c.id === categoryId);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  if (category.feeds.some(f => f.url === url)) {
    return res.status(409).json({ error: 'Feed already exists in this category' });
  }

  category.feeds.push({ url, name });
  writeFeeds(data);
  res.status(201).json({ success: true });
});

// Remove a feed from a category
app.delete('/api/categories/:categoryId/feeds', (req, res) => {
  const { categoryId } = req.params;
  const { url } = req.body;

  const data = readFeeds();
  const category = data.categories.find(c => c.id === categoryId);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  category.feeds = category.feeds.filter(f => f.url !== url);
  writeFeeds(data);
  res.json({ success: true });
});

// Add a new category
app.post('/api/categories', (req, res) => {
  const { name, icon, color } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const data = readFeeds();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  if (data.categories.some(c => c.id === id)) {
    return res.status(409).json({ error: 'Category already exists' });
  }

  data.categories.push({
    id,
    name,
    icon: icon || '📌',
    color: color || '#6B7280',
    feeds: []
  });
  writeFeeds(data);
  res.status(201).json({ success: true, id });
});

// Delete a category
app.delete('/api/categories/:categoryId', (req, res) => {
  const { categoryId } = req.params;
  const data = readFeeds();
  data.categories = data.categories.filter(c => c.id !== categoryId);
  writeFeeds(data);
  res.json({ success: true });
});

// Clear cache (force refresh)
app.post('/api/refresh', (req, res) => {
  if (fs.existsSync(CACHE_FILE)) {
    fs.unlinkSync(CACHE_FILE);
  }
  res.json({ success: true });
});

// ========== PODCAST EPISODE GENERATION ==========

function readEpisodes() {
  try {
    return JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf8'));
  } catch {
    return { episodes: [] };
  }
}

function writeEpisodes(data) {
  fs.writeFileSync(EPISODES_FILE, JSON.stringify(data, null, 2));
}

// Fetch all articles for episode generation
async function fetchAllArticles() {
  const data = readFeeds();
  const allItems = [];
  const fetchPromises = [];

  for (const cat of data.categories) {
    for (const feed of cat.feeds) {
      fetchPromises.push(
        fetchFeed(feed.url, feed.name, cat.id).then(items => {
          allItems.push(...items);
        })
      );
    }
  }

  await Promise.allSettled(fetchPromises);
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return allItems;
}

// Build a natural podcast script from articles
function buildEpisodeScript(articles, feedsData) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let script = `Welcome to My Podcast, your personal daily briefing. Today is ${dateStr}. `;
  script += `Here's what's happening across your interests. `;

  // Group by category
  const grouped = {};
  for (const article of articles) {
    if (!grouped[article.categoryId]) grouped[article.categoryId] = [];
    grouped[article.categoryId].push(article);
  }

  const categoryNames = {};
  for (const cat of feedsData.categories) {
    categoryNames[cat.id] = cat.name;
  }

  for (const [catId, catArticles] of Object.entries(grouped)) {
    const catName = categoryNames[catId] || catId;
    const top = catArticles.slice(0, 5); // Top 5 per category

    script += `\n\nMoving on to ${catName}. `;

    for (let i = 0; i < top.length; i++) {
      const a = top[i];
      script += `${a.source} reports: ${a.title}. `;
      if (a.snippet) {
        // Keep snippet concise for audio
        const shortSnippet = a.snippet.slice(0, 200);
        script += `${shortSnippet}. `;
      }
    }
  }

  script += `\n\nThat's your briefing for today. Thanks for listening to My Podcast. See you next time.`;

  return script;
}

// Generate TTS audio from text
async function generateAudio(text, outputPath) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  return new Promise((resolve, reject) => {
    const stream = tts.toStream(text);
    const chunks = [];

    stream.on('data', (chunk) => {
      // msedge-tts returns objects with 'audio' property
      if (chunk.audio) {
        chunks.push(chunk.audio);
      } else if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      }
    });

    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(outputPath, buffer);
      resolve(buffer.length);
    });

    stream.on('error', reject);
  });
}

// Track generation status
let generatingEpisode = false;

// Generate a new episode
app.post('/api/episodes/generate', async (req, res) => {
  if (generatingEpisode) {
    return res.status(409).json({ error: 'An episode is already being generated' });
  }

  generatingEpisode = true;
  const startTime = Date.now();

  try {
    // Fetch latest articles
    const articles = await fetchAllArticles();
    if (articles.length === 0) {
      generatingEpisode = false;
      return res.status(400).json({ error: 'No articles available to generate episode' });
    }

    const feedsData = readFeeds();
    const script = buildEpisodeScript(articles, feedsData);

    // Generate filename
    const now = new Date();
    const dateTag = now.toISOString().slice(0, 10);
    const filename = `episode-${dateTag}-${now.getTime()}.mp3`;
    const filepath = path.join(EPISODES_DIR, filename);

    // Generate audio
    const fileSize = await generateAudio(script, filepath);
    const duration = Math.round((Date.now() - startTime) / 1000);

    // Estimate audio duration (rough: ~150 words per minute for TTS)
    const wordCount = script.split(/\s+/).length;
    const audioDurationSecs = Math.round((wordCount / 150) * 60);

    // Save episode metadata
    const episode = {
      id: now.getTime().toString(),
      title: `Daily Briefing — ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      description: `Your personal briefing covering ${feedsData.categories.map(c => c.name).join(', ')}. ${articles.length} stories from across your feeds.`,
      filename,
      fileSize,
      duration: audioDurationSecs,
      pubDate: now.toISOString(),
      articleCount: articles.length,
      generationTime: duration
    };

    const episodesData = readEpisodes();
    episodesData.episodes.unshift(episode); // newest first
    writeEpisodes(episodesData);

    generatingEpisode = false;
    res.status(201).json(episode);
  } catch (err) {
    generatingEpisode = false;
    console.error('Episode generation failed:', err);
    res.status(500).json({ error: 'Failed to generate episode: ' + err.message });
  }
});

// List episodes
app.get('/api/episodes', (req, res) => {
  const data = readEpisodes();
  res.json(data.episodes);
});

// Delete an episode
app.delete('/api/episodes/:id', (req, res) => {
  const { id } = req.params;
  const data = readEpisodes();
  const episode = data.episodes.find(e => e.id === id);
  if (!episode) {
    return res.status(404).json({ error: 'Episode not found' });
  }

  // Delete the audio file
  const filepath = path.join(EPISODES_DIR, episode.filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }

  data.episodes = data.episodes.filter(e => e.id !== id);
  writeEpisodes(data);
  res.json({ success: true });
});

// Serve episode audio files
app.get('/episodes/:filename', (req, res) => {
  const filepath = path.join(EPISODES_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send('Episode not found');
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.sendFile(filepath);
});

// ========== PODCAST RSS FEED ==========

function escapeXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

app.get('/podcast.xml', (req, res) => {
  // Use the request's host for URLs so it works when deployed
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const data = readEpisodes();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(PODCAST_TITLE)}</title>
    <description>${escapeXml(PODCAST_DESCRIPTION)}</description>
    <language>${PODCAST_LANGUAGE}</language>
    <link>${escapeXml(baseUrl)}</link>
    <atom:link href="${escapeXml(baseUrl)}/podcast.xml" rel="self" type="application/rss+xml"/>
    <itunes:author>${escapeXml(PODCAST_AUTHOR)}</itunes:author>
    <itunes:summary>${escapeXml(PODCAST_DESCRIPTION)}</itunes:summary>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="News"/>
    <itunes:category text="Technology"/>
    <itunes:category text="Sports"/>
`;

  for (const ep of data.episodes) {
    const enclosureUrl = `${baseUrl}/episodes/${encodeURIComponent(ep.filename)}`;
    xml += `    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description)}</description>
      <pubDate>${new Date(ep.pubDate).toUTCString()}</pubDate>
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <enclosure url="${escapeXml(enclosureUrl)}" length="${ep.fileSize}" type="audio/mpeg"/>
      <itunes:duration>${formatDuration(ep.duration)}</itunes:duration>
      <itunes:summary>${escapeXml(ep.description)}</itunes:summary>
      <itunes:explicit>false</itunes:explicit>
    </item>
`;
  }

  xml += `  </channel>
</rss>`;

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
});

// Generation status endpoint
app.get('/api/episodes/status', (req, res) => {
  res.json({ generating: generatingEpisode });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Personal Podcast running at http://localhost:${PORT}`);
  console.log(`Podcast RSS feed: http://localhost:${PORT}/podcast.xml`);
});
