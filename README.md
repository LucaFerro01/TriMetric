# TriMetric

A unified sport data aggregation and analytics platform that integrates Strava, Bryton, and Zepp/Amazfit data to provide comprehensive athletic performance metrics.

## Features

- 🏃 **Multi-source sync**: Strava (OAuth + webhooks), Bryton (via Strava), Zepp/Amazfit
- 📊 **Analytics**: VO2max trends, FTP estimation, TDEE, weekly/monthly summaries
- 📂 **File import**: FIT and GPX file upload/parsing
- 📱 **PWA**: Installable Progressive Web App (works on Android, iOS, Desktop)
- 🔄 **Real-time sync**: Webhook-driven activity ingestion via Redis job queue

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript + Express |
| Database | PostgreSQL 15 + TimescaleDB |
| ORM/Migrations | Drizzle ORM |
| Cache / Queue | Redis + BullMQ |
| Frontend | React + TypeScript + Vite |
| Styling | TailwindCSS + shadcn/ui |
| Charts | Recharts |
| PWA | vite-plugin-pwa + Workbox |

## Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose

## Quick Start

```bash
# 1. Clone and install dependencies
git clone https://github.com/LucaFerro01/TriMetric
cd TriMetric
pnpm install

# 2. Configure environment
cp .env.example backend/.env
# Edit backend/.env with your Strava credentials

# 3. Start infrastructure
docker compose up -d

# 4. Run database migrations
pnpm --filter backend migrate

# 5. Start development servers
pnpm dev
```

The backend runs on http://localhost:3001 and the frontend on http://localhost:5173.

## Strava Setup

1. Create an app at https://www.strava.com/settings/api
2. Set the Authorization Callback Domain to `localhost`
3. Copy the Client ID and Secret to your `.env`
4. Register the webhook after starting the backend:
   ```bash
   curl -X POST http://localhost:3001/webhook/strava/subscribe
   ```

## Bryton Integration

Bryton devices sync automatically via Strava:
1. Open the **Bryton Active** app
2. Go to Settings → Connected Apps → Strava
3. Authorize the connection
4. All Bryton workouts will flow into TriMetric via the Strava webhook

## Zepp / Amazfit Integration

Uses the community-documented Mifit API (unofficial, may change):
1. Obtain your Zepp app token (see docs/zepp-auth.md)
2. Set `ZEPP_APP_TOKEN` in your `.env`
3. Activities sync automatically on login

## Architecture

```
Strava Webhook → Express → BullMQ (Redis) → Worker → PostgreSQL/TimescaleDB
                                                          ↑
Manual FIT/GPX upload ────────────────────────────────────┘
Zepp API (scheduled) ─────────────────────────────────────┘

React PWA (Vite) → REST API → PostgreSQL
```

## Project Structure

```
TriMetric/
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── db/       # Drizzle schema & migrations
│   │   ├── routes/   # Express route handlers
│   │   ├── services/ # Business logic (Strava, Zepp, metrics)
│   │   ├── workers/  # BullMQ job workers
│   │   └── index.ts  # App entry point
│   └── package.json
├── frontend/         # React PWA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── main.tsx
│   └── package.json
├── docker-compose.yml
└── .env.example
```
Project for sport data aggregation
