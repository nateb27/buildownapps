# LinkedIn Prospecting Agent

AI-powered LinkedIn lead prospecting agent that helps you find, score, and engage high-value prospects using Claude AI.

## Features

- **Prospect Management** - Add, edit, import (CSV), and organize LinkedIn prospects
- **AI Prospect Scoring** - Score prospects against your Ideal Customer Profile using Claude
- **AI Profile Analysis** - Get talking points, approach strategies, and risk factors for each prospect
- **AI Message Generation** - Generate personalized connection requests, follow-ups, and InMails
- **Campaign Sequences** - Create multi-step outreach campaigns with automated sequences
- **Pipeline Dashboard** - Visual funnel from New > Contacted > Replied > Meeting Booked > Converted
- **ICP Configuration** - Define target titles, industries, company sizes, and pain points
- **Message Templates** - Pre-built templates with variable substitution
- **CSV Import** - Bulk import prospects from LinkedIn Sales Navigator exports

## Quick Start

```bash
npm install
node seed.js          # Optional: load sample data
npm start
```

Then open http://localhost:3000 in your browser.

## AI Features (Claude Integration)

To enable AI-powered features, set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your_key_here
npm start
```

Or create a `.env` file:

```
ANTHROPIC_API_KEY=your_key_here
```

AI features include:
- **Score Prospect** - Rates each prospect 0-100 against your ICP with reasoning
- **Analyze Profile** - Generates talking points, pain point matches, and approach strategy
- **Generate Message** - Creates personalized LinkedIn messages (connection requests, follow-ups, InMails, break-up messages)
- **Bulk Score** - Score all prospects at once

The app works without an API key — AI buttons will be disabled but all other features function normally.

## Architecture

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express |
| Frontend | Vanilla JS SPA |
| AI | Claude API (Anthropic SDK) |
| Data | JSON file storage |

## API Endpoints

### Prospects
- `GET /api/prospects` - List all prospects
- `POST /api/prospects` - Add a prospect
- `PUT /api/prospects/:id` - Update a prospect
- `DELETE /api/prospects/:id` - Delete a prospect
- `POST /api/prospects/import` - Bulk import from CSV

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### AI
- `POST /api/ai/score-prospect` - Score a prospect against ICP
- `POST /api/ai/generate-message` - Generate personalized outreach
- `POST /api/ai/analyze-prospect` - Analyze a prospect's profile
- `POST /api/ai/bulk-score` - Score all prospects

### Configuration
- `GET /api/icp` - Get Ideal Customer Profile
- `PUT /api/icp` - Update ICP
- `GET /api/templates` - Get message templates
- `GET /api/stats` - Dashboard statistics

## Environment Variables

- `PORT` - Server port (default: 3000)
- `ANTHROPIC_API_KEY` - Anthropic API key for AI features

## Deployment

Deploy to any Node.js hosting service:

- **Railway** / **Render** / **Heroku** - Connect repo and deploy
- **VPS** - Run with `npm start` behind nginx/caddy

The app stores data in `data/` — ensure this directory persists across deployments.
