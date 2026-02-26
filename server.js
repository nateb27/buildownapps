const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'PersonalPodcast/1.0'
  }
});

const DATA_DIR = path.join(__dirname, 'data');
const FEEDS_FILE = path.join(DATA_DIR, 'feeds.json');
const CACHE_FILE = path.join(DATA_DIR, 'cache.json');
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
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

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Personal Podcast running at http://localhost:${PORT}`);
});
