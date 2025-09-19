# BalloonTracks — Live 24H Constellation

Operator-focused web app that visualizes the last 24 hours of WindBorne balloon tracks and overlays winds from Open-Meteo.

## Demo

- App: https://your-live-app-url.vercel.app
- Notes (one-liner): Systems-minded web dev turning messy telemetry into reliable, operator-first dashboards via rapid iteration.

## Features

- Pulls `00.json..23.json` from WindBorne’s live feed and tolerates corrupted/missing hours.
- Heuristically stitches points into tracks (speed and jump limits to avoid cross-links).
- Speed-colored polylines with tooltips (time, speed, altitude).
- Optional wind overlay from Open-Meteo ERA5 (pressure-level 700/500/300 hPa; fallback to 10 m).
- Lightweight controls: top tracks, min segments, thinning distance, speed cap, wind toggle, pressure level.
- Auto refreshes every 5 minutes.

## Data Sources

- **WindBorne**: `https://a.windbornesystems.com/treasure/{HH}.json` (HH = 00..23; arrays of `[lat, lon, alt?]`).
- **Open-Meteo**: ERA5 archive for pressure-level winds and 10 m fallback (no API key).

## Tech

- Next.js App Router (React, TypeScript)
- Leaflet + react-leaflet
- API Routes for server-side fetch, caching and CORS isolation

## Project Structure

src/
app/
api/
telemetry/route.ts # Returns stitched tracks as { [id]: TrackPoint[] }
wind/route.ts # Returns wind sample for lat/lon/time
components/
Map.tsx # Client map with controls and overlays
lib/
telemetry.ts # Robust fetch + stitching
wind.ts # Open-Meteo client with ERA5 + fallback
page.tsx # Server component page

## Getting Started

### Prereqs

- Node 18+
- npm or pnpm

### Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Build & Start

```bash
npm run build
npm start
```

Made with ☕️ caffine and curiosity by Sumedh.
