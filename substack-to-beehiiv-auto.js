#!/usr/bin/env node

/**
 * Automated Substack-to-Beehiiv Sync
 *
 * Fully automated — no manual CSV export needed.
 * Uses Puppeteer to log into your Substack dashboard, download the
 * subscriber CSV, then pushes new subscribers to Beehiiv via their API.
 *
 * Can be run on a cron schedule for hands-free ongoing sync.
 *
 * Usage:
 *   node substack-to-beehiiv-auto.js              # one-time sync
 *   node substack-to-beehiiv-auto.js --cron 60    # repeat every 60 minutes
 *   node substack-to-beehiiv-auto.js --dry-run    # download CSV only, don't push to Beehiiv
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// ---------------------------------------------------------------------------
// .env loader (no dependencies)
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUBSTACK_EMAIL = process.env.SUBSTACK_EMAIL;
const SUBSTACK_PASSWORD = process.env.SUBSTACK_PASSWORD;
const SUBSTACK_PUBLICATION = process.env.SUBSTACK_PUBLICATION; // e.g. "yourname" from yourname.substack.com

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
const BEEHIIV_API_BASE = 'https://api.beehiiv.com/v2';

const DELAY_MS = parseInt(process.env.SYNC_DELAY_MS, 10) || 300;
const DOWNLOAD_DIR = path.join(__dirname, '.downloads');
const SYNCED_FILE = path.join(__dirname, '.synced-emails.json');

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

function* parseCSV(text) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current.length > 0 || fields.length > 0) {
        fields.push(current);
        current = '';
      }
      if (fields.length > 0) yield fields.splice(0);
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      current += ch;
    }
  }
  if (current.length > 0 || fields.length > 0) {
    fields.push(current);
    yield fields.splice(0);
  }
}

function readSubscribersFromCSV(filePath) {
  const rows = [...parseCSV(fs.readFileSync(filePath, 'utf-8'))];
  if (rows.length === 0) throw new Error('CSV is empty');

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const emailIdx = headers.indexOf('email');
  if (emailIdx === -1) {
    throw new Error(`No "email" column found. Columns: ${headers.join(', ')}`);
  }

  const subscribers = [];
  for (let i = 1; i < rows.length; i++) {
    const email = (rows[i][emailIdx] || '').trim().toLowerCase();
    if (email && email.includes('@')) subscribers.push(email);
  }
  return subscribers;
}

// ---------------------------------------------------------------------------
// Already-synced tracking (avoids re-calling API for known subscribers)
// ---------------------------------------------------------------------------

function loadSyncedEmails() {
  if (!fs.existsSync(SYNCED_FILE)) return new Set();
  try {
    return new Set(JSON.parse(fs.readFileSync(SYNCED_FILE, 'utf-8')));
  } catch {
    return new Set();
  }
}

function saveSyncedEmails(set) {
  fs.writeFileSync(SYNCED_FILE, JSON.stringify([...set], null, 2));
}

// ---------------------------------------------------------------------------
// Puppeteer: Log into Substack and download subscriber CSV
// ---------------------------------------------------------------------------

async function downloadSubstackCSV() {
  console.log('Launching browser...');
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Set up download behavior
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_DIR,
    });

    // -- Step 1: Sign in to Substack --
    console.log('Navigating to Substack sign-in...');
    await page.goto('https://substack.com/sign-in', { waitUntil: 'networkidle2' });

    // Enter email
    console.log('Entering credentials...');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
    await page.type('input[type="email"], input[name="email"]', SUBSTACK_EMAIL);

    // Look for a "Sign in with password" or similar link/button, then click it
    const passwordToggle = await page.$('a[href*="password"], button:has-text("password"), .login-option-password');
    if (passwordToggle) {
      await passwordToggle.click();
      await sleep(1000);
    }

    // Some flows show a "Continue" button before password field
    const continueBtn = await page.$('button[type="submit"], button:has-text("Continue")');
    if (continueBtn) {
      await continueBtn.click();
      await sleep(2000);
    }

    // Enter password
    await page.waitForSelector('input[type="password"]', { timeout: 15000 });
    await page.type('input[type="password"]', SUBSTACK_PASSWORD);

    // Submit sign-in
    const signInBtn = await page.waitForSelector('button[type="submit"]', { timeout: 5000 });
    await signInBtn.click();

    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    console.log('Signed in successfully.');

    // -- Step 2: Navigate to the subscriber export page --
    const dashboardUrl = `https://${SUBSTACK_PUBLICATION}.substack.com/publish/subscribers`;
    console.log(`Navigating to subscriber dashboard: ${dashboardUrl}`);
    await page.goto(dashboardUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // -- Step 3: Trigger CSV export --
    // Look for the three-dot menu or export button
    console.log('Looking for export option...');

    // Try clicking the overflow/actions menu (three dots)
    const moreMenu = await page.$('[aria-label="More"], button.menu-button, .ellipsis-menu, [data-testid="more-menu"]');
    if (moreMenu) {
      await moreMenu.click();
      await sleep(1000);
    }

    // Click "Export" option
    const exportOption = await page.evaluateHandle(() => {
      const items = document.querySelectorAll('button, a, [role="menuitem"]');
      for (const item of items) {
        if (item.textContent.toLowerCase().includes('export')) return item;
      }
      return null;
    });

    if (exportOption && exportOption.asElement()) {
      await exportOption.asElement().click();
      console.log('Clicked export option.');
    } else {
      // Fallback: try direct URL-based CSV download if available
      console.log('Export button not found, trying direct download approach...');
      const cookies = await page.cookies();
      await downloadCSVViaFetch(cookies);
      await browser.close();
      return findLatestCSV();
    }

    // Wait for download to complete
    console.log('Waiting for CSV download...');
    await sleep(5000);

    // If there's a confirmation dialog, click through it
    const downloadBtn = await page.evaluateHandle(() => {
      const buttons = document.querySelectorAll('button, a');
      for (const b of buttons) {
        const text = b.textContent.toLowerCase();
        if (text.includes('download') || text.includes('all columns')) return b;
      }
      return null;
    });

    if (downloadBtn && downloadBtn.asElement()) {
      await downloadBtn.asElement().click();
      console.log('Clicked download button.');
      await sleep(8000);
    }

    await browser.close();
    console.log('Browser closed.');

    return findLatestCSV();
  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function downloadCSVViaFetch(cookies) {
  // Attempt to use the Substack API endpoint directly with session cookies
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const url = `https://${SUBSTACK_PUBLICATION}.substack.com/api/v1/subscriber_csv`;

  const res = await fetch(url, {
    headers: { Cookie: cookieHeader },
  });

  if (!res.ok) {
    throw new Error(`Direct CSV download failed: HTTP ${res.status}`);
  }

  const csv = await res.text();
  const filePath = path.join(DOWNLOAD_DIR, `subscribers_${Date.now()}.csv`);
  fs.writeFileSync(filePath, csv);
  console.log(`Downloaded CSV via direct fetch: ${filePath}`);
}

function findLatestCSV() {
  const files = fs.readdirSync(DOWNLOAD_DIR)
    .filter(f => f.endsWith('.csv'))
    .map(f => ({
      name: f,
      path: path.join(DOWNLOAD_DIR, f),
      mtime: fs.statSync(path.join(DOWNLOAD_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error('No CSV file found in download directory after export.');
  }

  console.log(`Using CSV: ${files[0].name}`);
  return files[0].path;
}

// ---------------------------------------------------------------------------
// Beehiiv API
// ---------------------------------------------------------------------------

async function createSubscription(email, sendWelcome = false) {
  const url = `${BEEHIIV_API_BASE}/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BEEHIIV_API_KEY}`,
    },
    body: JSON.stringify({
      email,
      reactivate_existing: false,
      send_welcome_email: sendWelcome,
      utm_source: 'substack_import',
    }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: res.status, ok: res.ok, data };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

async function syncToBeehiiv(csvPath, { dryRun, sendWelcome }) {
  const allEmails = readSubscribersFromCSV(csvPath);
  console.log(`\nFound ${allEmails.length} subscriber(s) in CSV.`);

  const synced = loadSyncedEmails();
  const newEmails = allEmails.filter(e => !synced.has(e));
  console.log(`Already synced: ${synced.size}. New to sync: ${newEmails.length}.\n`);

  if (newEmails.length === 0) {
    console.log('Nothing new to sync.');
    return;
  }

  if (dryRun) {
    console.log('Dry run — new subscribers that would be synced:');
    newEmails.forEach(e => console.log(`  ${e}`));
    console.log(`\nTotal: ${newEmails.length}`);
    return;
  }

  let created = 0, skipped = 0, failed = 0;

  for (let i = 0; i < newEmails.length; i++) {
    const email = newEmails[i];
    const progress = `[${i + 1}/${newEmails.length}]`;

    try {
      const result = await createSubscription(email, sendWelcome);
      if (result.ok) {
        console.log(`${progress} + ${email}`);
        created++;
        synced.add(email);
      } else if (result.status === 409) {
        console.log(`${progress} = ${email} (already in Beehiiv)`);
        skipped++;
        synced.add(email);
      } else {
        console.error(`${progress} ! ${email} — HTTP ${result.status}: ${JSON.stringify(result.data)}`);
        failed++;
      }
    } catch (err) {
      console.error(`${progress} ! ${email} — ${err.message}`);
      failed++;
    }

    if (i < newEmails.length - 1) await sleep(DELAY_MS);
  }

  saveSyncedEmails(synced);

  console.log('\n--- Summary ---');
  console.log(`Created:  ${created}`);
  console.log(`Skipped:  ${skipped} (already in Beehiiv)`);
  console.log(`Failed:   ${failed}`);
  console.log(`Total new: ${newEmails.length}`);

  if (failed > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runOnce(flags) {
  const csvPath = await downloadSubstackCSV();
  await syncToBeehiiv(csvPath, flags);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Automated Substack-to-Beehiiv Sync
====================================

Fully automated — uses Puppeteer to log into Substack, download your
subscriber list, and push new subscribers to Beehiiv. No manual export needed.

Usage:
  node substack-to-beehiiv-auto.js [options]

Options:
  --dry-run             Download CSV from Substack but don't push to Beehiiv
  --send-welcome        Send Beehiiv welcome email to new subscribers
  --cron <minutes>      Repeat the sync every N minutes (e.g. --cron 60)
  --help, -h            Show this help message

Required environment variables (set in .env):
  SUBSTACK_EMAIL            Your Substack login email
  SUBSTACK_PASSWORD         Your Substack password
  SUBSTACK_PUBLICATION      Your Substack subdomain (e.g. "matt" for matt.substack.com)
  BEEHIIV_API_KEY           Your Beehiiv API key
  BEEHIIV_PUBLICATION_ID    Your Beehiiv publication ID (e.g. pub_xxxxx)

Optional:
  SYNC_DELAY_MS             Delay between Beehiiv API calls in ms (default: 300)

How it works:
  1. Opens a headless browser, signs into Substack with your credentials
  2. Navigates to your subscriber dashboard and triggers a CSV export
  3. Parses the CSV and compares against previously synced emails
  4. Pushes only NEW subscribers to Beehiiv via their API
  5. Saves sync state to .synced-emails.json to avoid duplicates on next run
`);
    process.exit(0);
  }

  // Validate config
  const missing = [];
  if (!SUBSTACK_EMAIL) missing.push('SUBSTACK_EMAIL');
  if (!SUBSTACK_PASSWORD) missing.push('SUBSTACK_PASSWORD');
  if (!SUBSTACK_PUBLICATION) missing.push('SUBSTACK_PUBLICATION');

  const dryRun = args.includes('--dry-run');

  if (!dryRun) {
    if (!BEEHIIV_API_KEY) missing.push('BEEHIIV_API_KEY');
    if (!BEEHIIV_PUBLICATION_ID) missing.push('BEEHIIV_PUBLICATION_ID');
  }

  if (missing.length > 0) {
    console.error(`Error: Missing required environment variables:\n  ${missing.join('\n  ')}`);
    console.error('\nSet them in .env or export them in your shell.');
    process.exit(1);
  }

  const sendWelcome = args.includes('--send-welcome');
  const cronIdx = args.indexOf('--cron');
  const cronMinutes = cronIdx !== -1 ? parseInt(args[cronIdx + 1], 10) : 0;

  if (cronMinutes > 0) {
    console.log(`Running in cron mode — syncing every ${cronMinutes} minutes.\n`);
    while (true) {
      const start = Date.now();
      console.log(`\n=== Sync started at ${new Date().toISOString()} ===`);
      try {
        await runOnce({ dryRun, sendWelcome });
      } catch (err) {
        console.error('Sync failed:', err.message);
      }
      const elapsed = Date.now() - start;
      const waitMs = Math.max(0, cronMinutes * 60000 - elapsed);
      console.log(`Next sync in ${Math.round(waitMs / 60000)} minutes...`);
      await sleep(waitMs);
    }
  } else {
    await runOnce({ dryRun, sendWelcome });
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
