# Padel Court Booking

A simple booking app for sharing a padel court between friends and family.

## Features

- Weekly calendar view
- Book time slots with your name
- See who has booked what
- Mobile-friendly design
- Conflict detection (prevents double-booking)
- Remembers your name for future bookings

## Quick Start

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## How to Use

1. Navigate to any day using the week navigation
2. Click "+ Add Booking" on the day you want
3. Enter your name, select start/end times
4. Click Save

To edit or delete a booking, simply click on it.

## Deployment

This app can be deployed to any Node.js hosting service:

- **Railway**: Connect your repo and deploy
- **Render**: Create a new Web Service
- **Heroku**: Use the standard Node.js buildpack
- **VPS**: Run with `npm start` behind nginx/caddy

The app stores data in `data/bookings.json` - make sure this persists across deployments.

## Substack to Beehiiv Subscriber Sync

A built-in script to import your Substack subscribers into Beehiiv. Since Substack has no API, this works by reading Substack's CSV export and pushing each subscriber to Beehiiv via their API.

### Setup

1. Copy `.env.example` to `.env` and fill in your Beehiiv credentials:
   ```bash
   cp .env.example .env
   ```
2. Get your **API key** from [Beehiiv Integrations Settings](https://app.beehiiv.com/settings/integrations)
3. Get your **Publication ID** (starts with `pub_`) from your Beehiiv dashboard

### Export from Substack

1. Go to your Substack dashboard → **Settings** → **Exports**
2. Click **Create new export**
3. Download and unzip the export — look for `email_list.*.csv`

### Run the sync

```bash
# Preview what will be imported (no API calls)
node substack-to-beehiiv.js path/to/email_list.csv --dry-run

# Import subscribers
node substack-to-beehiiv.js path/to/email_list.csv

# Import and send Beehiiv welcome email to new subscribers
node substack-to-beehiiv.js path/to/email_list.csv --send-welcome
```

The script skips duplicates (already existing in Beehiiv) and tags all imports with `utm_source=substack_import` so you can track them.

### Fully Automated Sync (email-based, no manual export)

Monitors your email inbox for Substack's "new subscriber" notification emails and automatically adds each subscriber to Beehiiv in real-time. No scraping, no browser automation — just reads your own email via IMAP.

**Gmail setup:**
1. Enable IMAP in Gmail: Settings > Forwarding and POP/IMAP
2. Create an App Password: Google Account > Security > App passwords
3. Add your IMAP credentials to `.env`:
   ```
   IMAP_HOST=imap.gmail.com
   IMAP_PORT=993
   IMAP_USER=you@gmail.com
   IMAP_PASS=your_app_password_here
   ```
4. Make sure "New free subscriber" notifications are enabled in your Substack dashboard (Settings > Notifications)

**Run it:**
```bash
# Watch mode — stays connected, syncs new subscribers in real-time
npm run sync:auto

# Scan mode — process all existing notification emails once, then exit
npm run sync:scan

# Dry run — show what would be synced, no API calls
node substack-to-beehiiv-auto.js --scan --dry-run
```

The script tracks previously synced emails in `.synced-emails.json` so re-running is safe and only pushes new subscribers.

## Environment Variables

- `PORT` - Server port (default: 3000)
- `IMAP_HOST` - IMAP server hostname (required for auto sync, e.g. `imap.gmail.com`)
- `IMAP_PORT` - IMAP port (default: 993)
- `IMAP_USER` - Your email address (required for auto sync)
- `IMAP_PASS` - Your email password or app password (required for auto sync)
- `IMAP_MAILBOX` - Mailbox to monitor (default: INBOX)
- `BEEHIIV_API_KEY` - Your Beehiiv API key (required for sync)
- `BEEHIIV_PUBLICATION_ID` - Your Beehiiv publication ID (required for sync)
- `SYNC_DELAY_MS` - Delay between API calls in ms (default: 300)
