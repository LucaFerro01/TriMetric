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

### Production (Docker Compose)

```bash
# 1. Clone and configure
git clone https://github.com/LucaFerro01/TriMetric
cd TriMetric
cp .env.example .env
# Edit .env with your secrets (Strava credentials, JWT secrets, etc.)

# 2. Build and start all services
docker compose up --build -d
```

The frontend is available at http://localhost:8080 by default.
If you want to use port 80, set `FRONTEND_PORT=80` and make sure nothing else is already bound there.

### Local Development

```bash
# 1. Clone and install dependencies
git clone https://github.com/LucaFerro01/TriMetric
cd TriMetric
pnpm install

# 2. Configure environment
cp .env.example backend/.env
# Edit backend/.env with your Strava credentials

# 3. Start infrastructure (DB + Redis only)
docker compose up -d postgres redis

# 4. Generate and run database migrations
pnpm --filter backend migrate:generate
pnpm --filter backend migrate

# Alternatively, for a quick development setup (skips migration files):
# pnpm --filter backend db:push

# 5. Start development servers
pnpm dev
```

The backend runs on http://localhost:3001 and the frontend on http://localhost:5173.
If you are using Docker Compose, the API port is published on the host so you can also run `ngrok http 3001` against the local backend.

## Strava Setup

1. Create an app at https://www.strava.com/settings/api
2. Set the Authorization Callback Domain to `localhost`
3. Copy the Client ID and Secret to your `.env`
4. Register the webhook after starting the backend:
   ```bash
   curl -X POST http://localhost:3001/webhook/strava/subscribe
   ```
   If you are running the backend in Docker, make sure the API container is up and port 3001 is published on the host.
5. If you expose the backend with ngrok, set `BACKEND_URL` to the public ngrok HTTPS URL for the webhook callback and, if needed, set `STRAVA_REDIRECT_URI` to the ngrok URL for OAuth login callback.

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

The application runs as a set of microservices orchestrated by Docker Compose:

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Compose                       │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌────────────────────┐ │
│  │ frontend │    │   api    │    │       worker       │ │
│  │  nginx   │───▶│ Express  │    │  BullMQ (Strava)   │ │
│  │ 8080     │    │ port 3001│    │                    │ │
│  └──────────┘    └────┬─────┘    └────────┬───────────┘ │
│                       │                   │             │
│               ┌───────┴───────────────────┘             │
│               ▼                   ▼                     │
│  ┌────────────────────┐  ┌────────────────────┐         │
│  │      postgres      │  │       redis        │         │
│  │ TimescaleDB pg15   │  │    7-alpine        │         │
│  └────────────────────┘  └────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

| Service | Role |
|---------|------|
| `frontend` | nginx serving the React PWA; proxies `/api/*` → `api:3001` |
| `api` | Express HTTP server; runs DB migrations on startup |
| `worker` | BullMQ worker that processes async Strava jobs from Redis |
| `postgres` | TimescaleDB (PostgreSQL 15) for activities and metrics |
| `redis` | Redis 7 job queue for async activity ingestion |

All services have **health checks** and `restart: unless-stopped`. Startup order is enforced with `depends_on: condition: service_healthy`.

**Data flow:**

```
Strava Webhook → api → Redis (BullMQ) → worker → PostgreSQL/TimescaleDB
                                                       ↑
Manual FIT/GPX upload ─────────────────────────────────┘
Zepp API (scheduled) ──────────────────────────────────┘

React PWA (nginx) → /api/* proxy → api → PostgreSQL
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
│   │   ├── index.ts  # HTTP server entry point
│   │   └── worker.ts # BullMQ worker entry point (separate container)
│   ├── Dockerfile
│   └── package.json
├── frontend/         # React PWA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── main.tsx
│   ├── nginx.conf    # SPA routing + /api proxy config
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .env.example
```
Project for sport data aggregation
