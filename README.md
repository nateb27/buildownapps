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

## Environment Variables

- `PORT` - Server port (default: 3000)
