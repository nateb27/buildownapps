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

## Environment Variables

- `PORT` - Server port (default: 3000)
- `BEEHIIV_API_KEY` - Your Beehiiv API key (required for sync script)
- `BEEHIIV_PUBLICATION_ID` - Your Beehiiv publication ID (required for sync script)
- `SYNC_DELAY_MS` - Delay between API calls in ms (default: 300)
