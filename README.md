# Cyprus Rental Agent

Self-hosted property listing aggregator for Cyprus. Monitors multiple real estate websites, scrapes new listings matching your filters, stores them in SQLite, and pushes notifications to Telegram with rich formatting and images.

## Features

- **Multi-source scraping**: Bazaraki, dom.com.cy, home.cy, index.cy
- **Configurable filters**: Listing type, location, price range, bedrooms, furnished, keywords
- **Telegram notifications**: Rich HTML messages with images, inline reaction buttons
- **Price change detection**: Tracks price history and sends alerts on changes
- **Cross-source deduplication**: Fuzzy matching to avoid duplicate notifications
- **Web dashboard**: Browse and filter stored listings at `http://localhost:3000`
- **Proxy support**: Rotating proxy configuration for anti-bot bypassing
- **Docker deployment**: Single container, < 1.5GB RAM

## Tech Stack

| Component | Technology |
|---|---|
| Language | Node.js + TypeScript (ES Modules) |
| Static scraping | cheerio + undici |
| Dynamic scraping | Playwright (Chromium) |
| Database | SQLite (better-sqlite3, WAL mode) |
| Telegram | grammY + @grammyjs/auto-retry |
| Config | YAML + Zod validation |
| Scheduling | node-cron |
| Logging | pino |
| Dashboard | Express |

## Quick Start

### Prerequisites

- Node.js >= 20
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- A Telegram channel/group ID

### 1. Clone and install

```bash
cd "Cyprus Rental Agent"
npm install
npx playwright install chromium
```

### 2. Configure

```bash
cp config.example.yaml config.yaml
cp .env.example .env
```

Edit `.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHANNEL_ID=-100your_channel_id
```

Edit `config.yaml` to set your filters (locations, price range, bedrooms, etc.) and enable sources.

### 3. Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 4. Docker

```bash
docker compose up -d --build
```

## Configuration

All filters are global and apply to all enabled sources:

```yaml
scrape_interval_minutes: 300

filters:
  listing_type: rent        # rent | buy | any
  locations:
    - Limassol
    - Paphos
  property_type: apartment   # apartment | house | villa | studio | any
  min_bedrooms: 1
  max_bedrooms: 3
  min_price_eur: 500
  max_price_eur: 2000
  furnished: any             # true | false | any
  keywords_exclude:
    - commercial
    - office

telegram:
  bot_token: ${TELEGRAM_BOT_TOKEN}
  channel_id: ${TELEGRAM_CHANNEL_ID}
  send_images: true
  max_images_per_listing: 4

sources:
  - name: dom-com-cy
    enabled: true
    max_pages: 5
  - name: bazaraki
    enabled: true
    max_pages: 3
  - name: home-cy
    enabled: false
  - name: index-cy
    enabled: false
```

### Proxy Configuration

```yaml
proxies:
  enabled: true
  urls:
    - http://user:pass@proxy1:8080
    - http://user:pass@proxy2:8080
  rotate_strategy: round-robin  # round-robin | random
```

## Telegram Commands

| Command | Description |
|---|---|
| `/start` | Welcome message |
| `/status` | Current stats (total, active, by source) |
| `/latest` | Last 5 listings |

Each listing notification includes **Interested** / **Not Interested** inline buttons.

## Endpoints

| Path | Description |
|---|---|
| `GET /` | Web dashboard with listing browser |
| `GET /health` | Health check with stats |
| `GET /api/listings` | JSON API for listings |

## Project Structure

```
src/
  config/       Config loading + Zod validation
  types/        TypeScript interfaces
  db/           SQLite client, migrations, queries
  scraper/      Orchestrator, browser manager, HTTP client, rate limiter
  adapters/     Per-site adapters (bazaraki, dom-com-cy, home-cy, index-cy)
  telegram/     Bot, notifier, message builder, rate-limited queue
  images/       Image downloader
  scheduler/    Cron scheduling
  health/       Express server + dashboard
  utils/        Logger, retry, sleep, user agents
tests/
  unit/         Config, message builder, DB queries, rate limiter
  integration/  Parser tests with fixture HTML
  fixtures/     Saved HTML for parser tests
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Adding a New Source

1. Create `src/adapters/<name>/constants.ts` (URLs, selectors)
2. Create `src/adapters/<name>/parser.ts` (index + detail page parsers)
3. Create `src/adapters/<name>/adapter.ts` (extends `BaseAdapter`)
4. Register in `src/adapters/index.ts`
5. Add fixture HTML in `tests/fixtures/` and parser tests
