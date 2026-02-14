#!/usr/bin/env node

/**
 * Automated Substack-to-Beehiiv Sync (Email-based)
 *
 * Monitors your email inbox via IMAP for Substack's "new subscriber"
 * notification emails, extracts the subscriber's email address, and
 * adds them to Beehiiv automatically.
 *
 * No scraping, no browser automation, no Substack TOS issues —
 * you're just reading your own email.
 *
 * Usage:
 *   node substack-to-beehiiv-auto.js                # watch mode (real-time via IMAP IDLE)
 *   node substack-to-beehiiv-auto.js --scan          # scan existing emails once, then exit
 *   node substack-to-beehiiv-auto.js --dry-run       # show what would be synced, no API calls
 */

const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');

// ---------------------------------------------------------------------------
// .env loader
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const IMAP_HOST = process.env.IMAP_HOST;                     // e.g. imap.gmail.com
const IMAP_PORT = parseInt(process.env.IMAP_PORT, 10) || 993;
const IMAP_USER = process.env.IMAP_USER;                     // your email address
const IMAP_PASS = process.env.IMAP_PASS;                     // password or app password
const IMAP_MAILBOX = process.env.IMAP_MAILBOX || 'INBOX';    // or a Gmail label

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
const BEEHIIV_API_BASE = 'https://api.beehiiv.com/v2';

const DELAY_MS = parseInt(process.env.SYNC_DELAY_MS, 10) || 300;
const SYNCED_FILE = path.join(__dirname, '.synced-emails.json');

// Substack sends notifications with subjects like:
//   "New free subscriber on Substack"
//   "New paid subscriber on Substack"
const SUBSTACK_SUBJECT_PATTERNS = [
  /new free subscriber/i,
  /new paid subscriber/i,
  /new subscriber to/i,
];

// ---------------------------------------------------------------------------
// Synced-email tracking
// ---------------------------------------------------------------------------

function loadSynced() {
  if (!fs.existsSync(SYNCED_FILE)) return new Set();
  try {
    return new Set(JSON.parse(fs.readFileSync(SYNCED_FILE, 'utf-8')));
  } catch {
    return new Set();
  }
}

function saveSynced(set) {
  fs.writeFileSync(SYNCED_FILE, JSON.stringify([...set], null, 2));
}

// ---------------------------------------------------------------------------
// Email parsing — extract subscriber email from Substack notification
// ---------------------------------------------------------------------------

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractSubscriberEmail(envelope, bodyText) {
  // Strategy 1: Reply-To header — Substack puts the subscriber's email here
  if (envelope.replyTo && envelope.replyTo.length > 0) {
    const replyTo = envelope.replyTo[0];
    const addr = replyTo.address || '';
    // Filter out Substack's own addresses
    if (addr && !addr.includes('substack.com') && !addr.includes('noreply')) {
      return addr.toLowerCase();
    }
  }

  // Strategy 2: Parse the email body for an email address
  if (bodyText) {
    // Strip out common Substack/system addresses, find the subscriber's email
    const matches = bodyText.match(EMAIL_RE) || [];
    for (const match of matches) {
      const lower = match.toLowerCase();
      if (
        !lower.includes('substack.com') &&
        !lower.includes('noreply') &&
        !lower.includes('no-reply') &&
        !lower.includes('unsubscribe') &&
        lower !== (IMAP_USER || '').toLowerCase()
      ) {
        return lower;
      }
    }
  }

  return null;
}

function isSubstackNotification(envelope) {
  const subject = envelope.subject || '';
  return SUBSTACK_SUBJECT_PATTERNS.some(re => re.test(subject));
}

// ---------------------------------------------------------------------------
// Beehiiv API
// ---------------------------------------------------------------------------

async function addToBeehiiv(email, sendWelcome = false) {
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
// Process a single message
// ---------------------------------------------------------------------------

async function processMessage(client, seq, { dryRun, sendWelcome, synced }) {
  // Fetch envelope (headers) and body text
  const msg = await client.fetchOne(seq, {
    envelope: true,
    source: true,
  });

  if (!msg || !msg.envelope) return null;
  if (!isSubstackNotification(msg.envelope)) return null;

  // Decode body text for email extraction
  const bodyText = msg.source ? msg.source.toString('utf-8') : '';
  const subscriberEmail = extractSubscriberEmail(msg.envelope, bodyText);

  if (!subscriberEmail) {
    console.log(`  ? Could not extract subscriber email from: "${msg.envelope.subject}"`);
    return null;
  }

  if (synced.has(subscriberEmail)) return null; // already handled

  if (dryRun) {
    console.log(`  ~ ${subscriberEmail} (would sync)`);
    return subscriberEmail;
  }

  // Push to Beehiiv
  try {
    const result = await addToBeehiiv(subscriberEmail, sendWelcome);
    if (result.ok) {
      console.log(`  + ${subscriberEmail}`);
    } else if (result.status === 409) {
      console.log(`  = ${subscriberEmail} (already in Beehiiv)`);
    } else {
      console.error(`  ! ${subscriberEmail} — HTTP ${result.status}: ${JSON.stringify(result.data)}`);
      return null;
    }
    synced.add(subscriberEmail);
    saveSynced(synced);
    await sleep(DELAY_MS);
    return subscriberEmail;
  } catch (err) {
    console.error(`  ! ${subscriberEmail} — ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scan mode: process all existing Substack notification emails
// ---------------------------------------------------------------------------

async function scanExisting(client, flags) {
  const synced = loadSynced();
  console.log(`Previously synced: ${synced.size} subscriber(s)`);

  // Search for emails with Substack notification subjects
  const searchResults = await client.search({
    or: [
      { subject: 'new free subscriber' },
      { subject: 'new paid subscriber' },
      { subject: 'new subscriber to' },
    ],
  });

  if (searchResults.length === 0) {
    console.log('No Substack notification emails found in this mailbox.');
    return;
  }

  console.log(`Found ${searchResults.length} Substack notification email(s). Processing...\n`);

  let processed = 0;
  for (const seq of searchResults) {
    const result = await processMessage(client, seq, { ...flags, synced });
    if (result) processed++;
  }

  console.log(`\nDone. ${processed} new subscriber(s) ${flags.dryRun ? 'found' : 'synced'}.`);
}

// ---------------------------------------------------------------------------
// Watch mode: real-time monitoring via IMAP IDLE
// ---------------------------------------------------------------------------

async function watchMode(flags) {
  const synced = loadSynced();
  console.log(`Previously synced: ${synced.size} subscriber(s)`);
  console.log('Watching for new Substack notifications... (Ctrl+C to stop)\n');

  const client = createClient();

  // Reconnect logic
  const connect = async () => {
    await client.connect();
    const mailbox = await client.mailboxOpen(IMAP_MAILBOX);
    console.log(`Connected. Mailbox "${mailbox.path}" has ${mailbox.exists} message(s).`);
    return mailbox;
  };

  client.on('exists', async (data) => {
    console.log(`\n[${new Date().toISOString()}] New email detected in ${data.path}`);

    try {
      // Fetch the latest message(s)
      const status = await client.status(IMAP_MAILBOX, { messages: true });
      const latestSeq = status.messages;

      if (latestSeq > 0) {
        await processMessage(client, latestSeq, { ...flags, synced });
      }
    } catch (err) {
      console.error('Error processing new email:', err.message);
    }
  });

  client.on('close', async () => {
    console.log('\nConnection closed. Reconnecting in 10s...');
    await sleep(10000);
    try {
      await connect();
    } catch (err) {
      console.error('Reconnect failed:', err.message);
      process.exit(1);
    }
  });

  client.on('error', (err) => {
    console.error('IMAP error:', err.message);
  });

  await connect();

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await client.logout();
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// IMAP client factory
// ---------------------------------------------------------------------------

function createClient() {
  return new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_PORT === 993,
    auth: {
      user: IMAP_USER,
      pass: IMAP_PASS,
    },
    logger: false, // suppress verbose IMAP logs
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Automated Substack-to-Beehiiv Sync (Email-based)
==================================================

Monitors your email inbox for Substack's "new subscriber" notifications
and automatically adds each subscriber to Beehiiv. No scraping needed —
just reads your own email via IMAP.

Usage:
  node substack-to-beehiiv-auto.js [options]

Modes:
  (default)            Watch mode — stays connected via IMAP IDLE,
                       syncs new subscribers in real-time as they arrive
  --scan               Scan mode — process all existing notification emails
                       once, then exit
  --dry-run            Show what would be synced without calling Beehiiv API
  --send-welcome       Send Beehiiv welcome email to new subscribers

Required environment variables (set in .env):
  IMAP_HOST              IMAP server (e.g. imap.gmail.com)
  IMAP_USER              Your email address
  IMAP_PASS              Your email password or app password
  BEEHIIV_API_KEY        Your Beehiiv API key
  BEEHIIV_PUBLICATION_ID Your Beehiiv publication ID

Optional:
  IMAP_PORT              IMAP port (default: 993)
  IMAP_MAILBOX           Mailbox to monitor (default: INBOX)
  SYNC_DELAY_MS          Delay between Beehiiv API calls in ms (default: 300)

Gmail setup:
  1. Enable IMAP in Gmail Settings > Forwarding and POP/IMAP
  2. Create an App Password: Google Account > Security > App passwords
  3. Use the app password as IMAP_PASS (not your regular password)
  4. Optionally create a Gmail filter to label Substack emails,
     then set IMAP_MAILBOX to that label name

How it works:
  1. Connects to your email via IMAP
  2. Finds emails with subjects like "New free subscriber on Substack"
  3. Extracts the subscriber email from Reply-To header or email body
  4. Pushes new subscribers to Beehiiv via their API
  5. Tracks synced emails in .synced-emails.json to avoid duplicates
`);
    process.exit(0);
  }

  // Validate config
  const missing = [];
  if (!IMAP_HOST) missing.push('IMAP_HOST');
  if (!IMAP_USER) missing.push('IMAP_USER');
  if (!IMAP_PASS) missing.push('IMAP_PASS');

  const dryRun = args.includes('--dry-run');
  const sendWelcome = args.includes('--send-welcome');
  const scanMode = args.includes('--scan');

  if (!dryRun) {
    if (!BEEHIIV_API_KEY) missing.push('BEEHIIV_API_KEY');
    if (!BEEHIIV_PUBLICATION_ID) missing.push('BEEHIIV_PUBLICATION_ID');
  }

  if (missing.length > 0) {
    console.error(`Error: Missing required environment variables:\n  ${missing.join('\n  ')}`);
    console.error('\nSet them in .env or export them. Run with --help for details.');
    process.exit(1);
  }

  const flags = { dryRun, sendWelcome };

  if (scanMode) {
    // One-shot: scan existing emails and exit
    const client = createClient();
    await client.connect();
    await client.mailboxOpen(IMAP_MAILBOX);
    await scanExisting(client, flags);
    await client.logout();
  } else {
    // Watch mode: stay connected, process in real-time
    await watchMode(flags);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
