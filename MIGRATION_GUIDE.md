# Migration Guide: Hetzner → Vercel + Neon + GitHub Actions

This guide walks you through migrating the Cyprus Rental Agent from a self-hosted Hetzner VPS to a fully serverless stack with **$0/month** on free tiers.

## Architecture Overview

```
BEFORE (Hetzner VPS ~€5-10/mo)          AFTER (Serverless $0/mo)
┌─────────────────────────┐              ┌──────────────┐
│  Docker on Hetzner      │              │   Vercel      │
│  ├── PostgreSQL 16      │    ──────►   │  Next.js UI   │
│  ├── Express API        │              │  + API Routes │
│  ├── Next.js Frontend   │              └──────┬───────┘
│  └── Crawlers + Cron    │                     │
└─────────────────────────┘              ┌──────▼───────┐
                                         │   Neon DB     │
                                         │  PostgreSQL   │
                                         └──────▲───────┘
                                                │
                                         ┌──────┴───────┐
                                         │ GitHub Actions│
                                         │  Crawlers     │
                                         │  (cron every  │
                                         │   5 hours)    │
                                         └──────────────┘
```

**What moved where:**
| Component | Before | After |
|-----------|--------|-------|
| Database | PostgreSQL in Docker | Neon (managed Postgres) |
| API | Express on port 3000 | Next.js API Routes on Vercel |
| Frontend | Next.js in Docker | Vercel (auto-deployed) |
| Crawlers | Node.js process with cron | GitHub Actions workflow |
| Images | Optional download + URL | URL only (proxy on Vercel) |
| Auth | None | NextAuth.js with Neon |
| Reverse proxy | Caddy | Not needed (Vercel handles HTTPS) |

---

## Prerequisites

- GitHub account (for Actions + repo hosting)
- Vercel account (free Hobby tier): https://vercel.com
- Neon account (free tier): https://neon.tech
- SSH access to your current Hetzner server
- Your repo pushed to GitHub

---

## Step 1: Create Neon Database

### 1.1 Sign up and create project

1. Go to https://console.neon.tech
2. Sign up (GitHub login works)
3. Click **"New Project"**
4. Settings:
   - **Name**: `cyprus-rental`
   - **Region**: Choose closest to your users (e.g., `eu-central-1` for Cyprus/Europe)
   - **Postgres version**: 16 (matches your current setup)
5. Click **Create Project**

### 1.2 Get your connection string

After creation, Neon shows your connection details. You need two variants:

**Pooled connection string** (for Vercel serverless — use this one):
```
postgresql://user:password@ep-xxx-yyy.eu-central-1.aws.neon.tech/cyprus_rental?sslmode=require
```

**Direct connection string** (for migrations and pg_restore):
```
postgresql://user:password@ep-xxx-yyy.eu-central-1.aws.neon.tech/cyprus_rental?sslmode=require
```

> Copy both. The pooled one is shown on the dashboard with "Pooled connection" toggle ON.

### 1.3 Migrate data from Hetzner

SSH into your Hetzner server and dump the database:

```bash
# On Hetzner server
sudo docker exec cyprus-rental-postgres pg_dump \
  -U agent \
  -d cyprus_rental \
  --no-owner \
  --no-acl \
  --format=custom \
  -f /tmp/cyprus_rental.dump

# Copy dump to your local machine
sudo docker cp cyprus-rental-postgres:/tmp/cyprus_rental.dump ./cyprus_rental.dump
```

Restore into Neon:

```bash
# On your local machine (needs pg_restore installed — brew install libpq)
pg_restore \
  --no-owner \
  --no-acl \
  --dbname="postgresql://neondb_owner:npg_Xo9Lw8cYbAgf@ep-patient-bonus-amy4dnsd-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" \
  cyprus_rental.dump
```

> **If pg_restore gives errors about existing objects**, add `--clean --if-exists` flags.
> **If you don't have pg_restore**, you can use plain SQL format instead:
> ```bash
> docker exec cyprus-rental-agent-postgres-1 pg_dump -U agent -d cyprus_rental --no-owner --no-acl > dump.sql
> psql "postgresql://neondb_owner:npg_Xo9Lw8cYbAgf@ep-patient-bonus-amy4dnsd-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" < dump.sql
> ```

### 1.4 Verify the migration

```bash
psql "postgresql://user:password@ep-xxx.neon.tech/cyprus_rental?sslmode=require"

-- Check row counts
SELECT COUNT(*) FROM listings;
SELECT COUNT(*) FROM listings WHERE is_active = TRUE;
SELECT COUNT(*) FROM scrape_runs;
SELECT COUNT(*) FROM webhook_subscriptions;

-- Verify full-text search works
SELECT id, title FROM listings
WHERE search_vector @@ websearch_to_tsquery('english', 'limassol apartment')
LIMIT 5;

-- Check that JSONB images are intact
SELECT id, jsonb_array_length(images) as img_count FROM listings
WHERE images IS NOT NULL AND jsonb_array_length(images) > 0
LIMIT 5;
```

### 1.5 Run the auth migration

The auth tables need to be created. Connect to Neon and run:

```sql
CREATE TABLE IF NOT EXISTS auth_users (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
```

Also update the schema_version table so the migration system knows this was applied:

```sql
INSERT INTO schema_version (version) VALUES (2) ON CONFLICT DO NOTHING;
```

### 1.6 Seed your admin user

From your local machine (in the project directory):

```bash
# Install deps if needed
npm install

# Seed the admin user
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/cyprus_rental?sslmode=require" \
  npx tsx scripts/seed-admin.ts your@email.com YourSecurePassword "Your Name"
```

You should see: `Admin user created/updated: { id: 1, email: 'your@email.com', name: 'Your Name' }`

---

## Step 2: Set Up GitHub Actions Crawler

### 2.1 Add repository secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret Name | Value | Where to get it |
|-------------|-------|-----------------|
| `DATABASE_URL` | Your Neon pooled connection string | Neon dashboard |
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | From your `.env` on Hetzner |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID | From your `.env` on Hetzner |
| `APIFY_API_TOKEN` | Your Apify API token | From your `.env` on Hetzner |
| `TELEGRAM_API_ID` | Telegram MTProto API ID | From your `.env` on Hetzner |
| `TELEGRAM_API_HASH` | Telegram MTProto API hash | From your `.env` on Hetzner |
| `TELEGRAM_SESSION` | Telegram session string | See section 2.2 below |

### 2.2 Export Telegram session string

The Telegram MTProto client stores a session file on disk. GitHub Actions runners are ephemeral, so you need to convert it to a string.

On your Hetzner server, find the session file:

```bash
# Usually in the project's data directory or root
docker exec cyprus-rental-agent-agent-1 find /app -name "*.session" -o -name "telegram_session*" 2>/dev/null
```

If you're using `telegram` (GramJS), the session is typically stored as a `StringSession`. Check your Telegram channel adapter code for how the session is initialized. You may need to run a one-time script to export it:

```typescript
// scripts/export-telegram-session.ts
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

// Initialize with your existing session file, then export as string
const session = new StringSession(''); // or load from file
const client = new TelegramClient(session, apiId, apiHash, {});
await client.start({ ... });
console.log('Session string:', client.session.save());
```

Save the output as the `TELEGRAM_SESSION` secret.

> **If you're not using Telegram channels**, skip this secret.

### 2.3 Update config.yaml for Neon

Your `config.yaml` needs to use the `DATABASE_URL` env var. Check that your config loader reads from the environment:

```yaml
database:
  connection_string: ${DATABASE_URL}
```

Or if your config loader doesn't support env var substitution, the `dotenv` config at the top of `src/crawl.ts` handles it through `process.env.DATABASE_URL`.

### 2.4 Test the crawler manually

Push your code to GitHub, then:

1. Go to **Actions** tab in your GitHub repo
2. Click **"Crawl Cycle"** workflow on the left
3. Click **"Run workflow"** → **"Run workflow"**
4. Watch the logs

The workflow will:
1. Check out the code
2. Install Node.js 20 and npm dependencies
3. Install Playwright Chromium browser
4. Build TypeScript
5. Run `node dist/crawl.js` (single crawl cycle)
6. Exit

Expected runtime: 10-30 minutes depending on source count and page limits.

### 2.5 Verify crawler results

After the workflow completes:

```bash
psql "your-neon-connection-string"

-- Check recent scrape runs
SELECT id, started_at, completed_at, status, new_listings, errors
FROM scrape_runs ORDER BY started_at DESC LIMIT 5;

-- Check new listings were inserted
SELECT source, COUNT(*) FROM listings
WHERE first_seen_at > NOW() - INTERVAL '1 hour'
GROUP BY source;
```

Also check your Telegram — you should have received notifications for any new listings.

---

## Step 3: Deploy to Vercel

### 3.1 Connect GitHub repo to Vercel

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Select your GitHub repo
4. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `web` (click "Edit" and type `web`)
   - **Build Command**: `next build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### 3.2 Add environment variables

In the Vercel project settings, add these environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Your Neon **pooled** connection string | Must include `?sslmode=require` |
| `NEXTAUTH_SECRET` | Random 32+ char string | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Your Vercel domain |
| `GITHUB_TOKEN` | A GitHub personal access token | For triggering scrape from dashboard |
| `GITHUB_REPO` | `your-username/your-repo` | e.g., `avishaiasaf/cyprus-rental-agent` |
| `GITHUB_CRAWL_WORKFLOW` | `crawl.yml` | The workflow filename |

**To create the GitHub token:**
1. Go to https://github.com/settings/tokens?type=beta (Fine-grained tokens)
2. Create a new token with:
   - **Repository access**: Only select your repo
   - **Permissions**: Actions → Read and write
3. Copy the token

**To generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3.3 Deploy

Click **"Deploy"** in Vercel. The first deploy will:
1. Install `web/` dependencies
2. Build the Next.js app
3. Deploy to Vercel's edge network

### 3.4 Verify the deployment

After deployment:

1. **Visit your Vercel URL** — you should see the login page
2. **Sign in** with the admin credentials you seeded in Step 1.6
3. **Browse listings** — images should load via the image proxy
4. **Check the dashboard** — stats should show your listing counts
5. **Trigger a scrape** from the dashboard — this calls the GitHub Actions workflow

### 3.5 Custom domain (optional)

1. In Vercel: **Settings** → **Domains** → Add your domain
2. Update DNS records as instructed by Vercel
3. Update `NEXTAUTH_URL` env var to your custom domain

---

## Step 4: Verify Everything Works

Run through this checklist over 48 hours before decommissioning Hetzner:

### Automated checks
- [ ] GitHub Actions crawl runs every 5 hours (check Actions tab)
- [ ] New listings appear in Neon after each crawl
- [ ] Telegram notifications fire for new listings
- [ ] No crawler errors in GitHub Actions logs

### Manual checks
- [ ] Login works on Vercel
- [ ] Listing search and filters work
- [ ] Full-text search returns results
- [ ] Images load (check multiple sources — some may have hotlink protection)
- [ ] Listing detail pages show all data
- [ ] Dashboard shows stats and scrape history
- [ ] "Trigger Scrape" button works from dashboard
- [ ] Webhook subscriptions page loads

### Image verification
Browse through listings from different sources. For each source, verify images load:
- [ ] spitogatos-cy images
- [ ] bazaraki images
- [ ] dom-com-cy images
- [ ] home-cy images
- [ ] online-properties images
- [ ] buysellcyprus images
- [ ] rentals-cyprus images
- [ ] index-cy images
- [ ] facebook images
- [ ] telegram images

If images from a specific source don't load, the image proxy at `/api/image-proxy` should handle it. Check browser DevTools Network tab to see if requests hit the proxy.

---

## Step 5: Decommission Hetzner

Once you've verified everything works for 48+ hours:

### 5.1 Final backup

```bash
# On Hetzner
docker exec cyprus-rental-agent-postgres-1 pg_dump \
  -U agent -d cyprus_rental --no-owner --no-acl \
  -f /tmp/final_backup.sql

# Copy to local machine
scp hetzner:/tmp/final_backup.sql ./backups/final_backup_$(date +%Y%m%d).sql
```

### 5.2 Stop the Hetzner agent

```bash
# On Hetzner
cd /path/to/cyprus-rental-agent
docker compose down
```

### 5.3 Wait another 24 hours

Make sure nothing breaks. The crawlers are already running on GitHub Actions, and the UI is on Vercel.

### 5.4 Delete the Hetzner server

Go to Hetzner Cloud console and delete the server.

### 5.5 Clean up Docker files (optional)

These files are no longer needed but can be kept for reference:

```
Dockerfile
web/Dockerfile
docker-compose.yml
docker-compose.prod.yml
Caddyfile (if exists)
```

---

## Cost Breakdown

### Free Tier Limits

| Service | Free Tier | Your Usage | Risk of Exceeding |
|---------|-----------|------------|-------------------|
| **Vercel Hobby** | 100GB bandwidth, 100hr serverless | Low traffic personal app | Very low |
| **Neon Free** | 0.5GB storage, 190 compute hours | ~100MB data, light queries | Low |
| **GitHub Actions** | 2,000 min/month (free), 3,000 (Pro $4/mo) | ~150 min/day = ~4,500 min/mo | **Medium** |

### GitHub Actions minutes breakdown

Each crawl cycle: ~15-25 minutes
Runs per day: ~5 (every 5 hours)
Monthly: 5 × 25 × 30 = **3,750 minutes**

This exceeds the free 2,000 minute limit. Options:
1. **Make the repo public** → unlimited free minutes
2. **GitHub Pro** ($4/month) → 3,000 minutes
3. **Reduce crawl frequency** to every 8 hours → ~2,800 min/month
4. **Split adapters**: Run Cheerio-only adapters more often (cheaper), Playwright adapters less

### If you need to scale

| Upgrade | Cost | What you get |
|---------|------|-------------|
| Vercel Pro | $20/mo | 1TB bandwidth, 1000hr serverless, 60s function timeout |
| Neon Launch | $19/mo | Always-on compute (no cold starts), 10GB storage |
| GitHub Pro | $4/mo | 3,000 Actions minutes |

---

## Troubleshooting

### "Neon cold start" — first request after idle is slow (2-5s)

This is expected on the free tier. Neon suspends compute after 5 minutes of inactivity. The first request after suspension takes 2-5 seconds to wake up.

**Fix**: Accept it, or upgrade to Neon Launch ($19/mo) for always-on compute.

### Images don't load from certain sources

Some real estate sites block hotlinking. The image proxy at `/api/image-proxy` handles this by fetching images server-side with a spoofed Referer header.

**Check**: Open browser DevTools → Network tab. Look for image requests:
- If hitting the source URL directly → add the image proxy fallback in the frontend component
- If hitting `/api/image-proxy` and still failing → the source may be using token-based URLs that expire

### GitHub Actions crawl fails

Check the Actions tab for error logs. Common issues:
- **Playwright timeout**: Increase timeout in adapter config, or the source site may be blocking GitHub's IP range
- **Neon connection refused**: Check your `DATABASE_URL` secret is correct and includes `?sslmode=require`
- **Telegram errors**: Session string may be invalid or expired — re-export it

### "NEXTAUTH_URL" mismatch errors

Make sure `NEXTAUTH_URL` exactly matches your Vercel deployment URL (including `https://`). If using a custom domain, update this env var.

### Vercel function timeout (10s on Hobby)

If API routes are slow:
- The listings endpoint with complex filters + FTS may be slow on first hit (Neon cold start)
- Subsequent requests should be fast (< 1s)
- If consistently slow, check your Neon query plan: `EXPLAIN ANALYZE SELECT ...`
- Add missing indexes if needed

### Dashboard "Trigger Scrape" returns 503

Check that `GITHUB_TOKEN` and `GITHUB_REPO` env vars are set correctly in Vercel. The token needs `actions:write` permission on the repo.

---

## Architecture Decisions Reference

### Why GitHub Actions for crawlers?

Crawlers need Playwright (Chromium browser), which requires ~1.5GB RAM. Vercel serverless functions have a 10s timeout (Hobby) and 1GB memory limit — not enough for browser-based scraping. GitHub Actions runners have 7GB RAM and a 6-hour job timeout.

### Why Neon instead of Supabase?

Both are managed Postgres. Neon was chosen because:
- The free tier is generous enough (0.5GB, 190 compute hours)
- Wire-compatible with your existing `pg` driver (zero query changes for the crawler)
- The `@neondatabase/serverless` driver is optimized for Vercel's edge/serverless runtime
- No vendor lock-in — it's standard Postgres

### Why keep the image proxy instead of downloading?

Downloading images would require storage (S3/R2) and adds cost. The image proxy:
- Is free (runs as a Vercel serverless function)
- Caches at the CDN layer for 24 hours (`Cache-Control: public, max-age=86400`)
- Handles hotlink protection by spoofing Referer headers
- No storage costs, no bandwidth costs (within Vercel free tier)

### Why NextAuth.js with Credentials?

For a small private tool with invite-only access:
- No external auth provider needed (no Google Cloud project, no OAuth setup)
- Passwords stored as bcrypt hashes in your own database
- JWT sessions (stateless, fast, no session table queries)
- Easy to add Google/GitHub OAuth later if needed
