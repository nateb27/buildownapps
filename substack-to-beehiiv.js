#!/usr/bin/env node

/**
 * Substack to Beehiiv Subscriber Sync
 *
 * Since Substack has no API, this script reads the CSV export from Substack
 * and adds each subscriber to Beehiiv via the Beehiiv API.
 *
 * Usage:
 *   1. Export your subscriber list from Substack (Settings > Exports)
 *   2. Set your Beehiiv API key and publication ID in .env
 *   3. Run: node substack-to-beehiiv.js <path-to-substack-csv>
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
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

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
const BEEHIIV_API_BASE = 'https://api.beehiiv.com/v2';

// How long to wait between API calls (ms) to respect rate limits
const DELAY_MS = parseInt(process.env.SYNC_DELAY_MS, 10) || 300;

// ---------------------------------------------------------------------------
// CSV Parsing (minimal, no external dependencies)
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const lines = [];
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
      lines.push(current);
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current.length > 0 || lines.length > 0) {
        lines.push(current);
        current = '';
      }
      if (lines.length > 0) {
        yield lines.splice(0);
      }
      // skip \r\n pair
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      current += ch;
    }
  }
  // last field / row
  if (current.length > 0 || lines.length > 0) {
    lines.push(current);
    yield lines.splice(0);
  }
}

function readSubstackCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows = [...parseCSV(raw)];
  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const emailIdx = headers.indexOf('email');
  if (emailIdx === -1) {
    throw new Error(
      `Could not find "email" column in CSV. Found columns: ${headers.join(', ')}`
    );
  }

  const subscribers = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const email = (row[emailIdx] || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;

    // Build a record with all available columns for reference
    const record = { email };
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (row[j] || '').trim();
    }
    subscribers.push(record);
  }

  return subscribers;
}

// ---------------------------------------------------------------------------
// Beehiiv API
// ---------------------------------------------------------------------------

async function createSubscription(email, opts = {}) {
  const url = `${BEEHIIV_API_BASE}/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`;

  const body = {
    email,
    reactivate_existing: false,
    send_welcome_email: opts.sendWelcome ?? false,
    utm_source: 'substack_import',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BEEHIIV_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { status: res.status, ok: res.ok, data };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
Substack to Beehiiv Subscriber Sync
====================================

Usage:
  node substack-to-beehiiv.js <substack-csv-file> [options]

Options:
  --dry-run          Parse CSV and show what would be imported, without calling the API
  --send-welcome     Send Beehiiv welcome email to new subscribers
  --help, -h         Show this help message

Environment variables (set in .env or shell):
  BEEHIIV_API_KEY          Your Beehiiv API key (required)
  BEEHIIV_PUBLICATION_ID   Your Beehiiv publication ID, e.g. pub_xxxx (required)
  SYNC_DELAY_MS            Delay between API calls in ms (default: 300)

Steps:
  1. Export subscribers from Substack: Settings > Exports > Create new export
  2. Unzip and locate the CSV file (usually named email_list.*.csv)
  3. Set BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID in .env
  4. Run this script with the CSV file path
`);
    process.exit(0);
  }

  // Parse flags
  const csvFile = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const sendWelcome = args.includes('--send-welcome');

  if (!csvFile) {
    console.error('Error: Please provide the path to your Substack CSV export.');
    process.exit(1);
  }

  if (!fs.existsSync(csvFile)) {
    console.error(`Error: File not found: ${csvFile}`);
    process.exit(1);
  }

  if (!dryRun) {
    if (!BEEHIIV_API_KEY) {
      console.error('Error: BEEHIIV_API_KEY is not set. Add it to .env or export it.');
      process.exit(1);
    }
    if (!BEEHIIV_PUBLICATION_ID) {
      console.error('Error: BEEHIIV_PUBLICATION_ID is not set. Add it to .env or export it.');
      process.exit(1);
    }
  }

  // Read CSV
  console.log(`Reading CSV: ${csvFile}`);
  const subscribers = readSubstackCSV(csvFile);
  console.log(`Found ${subscribers.length} subscriber(s) in CSV.\n`);

  if (subscribers.length === 0) {
    console.log('No subscribers to import.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('Dry run mode — no API calls will be made.\n');
    console.log('Subscribers that would be imported:');
    for (const sub of subscribers) {
      const type = sub['type'] || sub['subscription type'] || 'unknown';
      console.log(`  ${sub.email}  (type: ${type})`);
    }
    console.log(`\nTotal: ${subscribers.length}`);
    process.exit(0);
  }

  // Sync to Beehiiv
  console.log('Starting sync to Beehiiv...\n');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < subscribers.length; i++) {
    const sub = subscribers[i];
    const progress = `[${i + 1}/${subscribers.length}]`;

    try {
      const result = await createSubscription(sub.email, { sendWelcome });

      if (result.ok) {
        console.log(`${progress} + ${sub.email}`);
        created++;
      } else if (result.status === 409) {
        // Already exists
        console.log(`${progress} = ${sub.email} (already exists)`);
        skipped++;
      } else {
        console.error(
          `${progress} ! ${sub.email} — HTTP ${result.status}: ${JSON.stringify(result.data)}`
        );
        failed++;
      }
    } catch (err) {
      console.error(`${progress} ! ${sub.email} — ${err.message}`);
      failed++;
    }

    // Rate-limit delay (skip after last item)
    if (i < subscribers.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Created:  ${created}`);
  console.log(`Skipped:  ${skipped} (already in Beehiiv)`);
  console.log(`Failed:   ${failed}`);
  console.log(`Total:    ${subscribers.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
