# Reliability history

Records how late each FGC line actually runs over time, so the app can say
things like *"L6 typically runs +4 min around 08:00 on weekdays."* Built on a
tiny Supabase Postgres + a GitHub Actions cron. All database access is
server-side with the `service_role` key — it never reaches the browser.

## Pipeline

```
GitHub Action (every 10 min)
  └─ scripts/capture-delays.mjs
       ├─ FGC open data: positions (id→line) ⋈ trip-updates (tripId→delay)
       └─ INSERT median delay per line  ──►  Supabase: delay_observations
                                                   │
                                       view: delay_stats  (median/p90 by
                                       line × weekday|weekend × 30-min bucket,
                                       rolling 8 weeks)
                                                   │
                                    GET /api/reliability?line=L6  ──►  UI
```

## One-time setup

**1. Create the tables.** In Supabase → **SQL Editor** → paste
[`supabase/schema.sql`](../supabase/schema.sql) → **Run**.

**2. Local env (optional, for testing).** Copy `.env.local.example` to
`.env.local` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from
Supabase → Project Settings → API). `.env.local` is gitignored — never commit
it.

**3. Production capture secrets.** In GitHub → repo **Settings → Secrets and
variables → Actions → New repository secret**, add both:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Never paste the service-role key anywhere else — not in code, not in chat.

**4. Kick off the cron.** The workflow runs every 10 min once secrets exist.
Trigger the first run manually: GitHub → **Actions → Capture FGC delays → Run
workflow**. Check the run log for `inserted N observations`, then confirm rows
in Supabase → Table Editor → `delay_observations`.

## Verifying

```bash
# Dry-run the capture locally (needs .env.local):
export $(grep -v '^#' .env.local | xargs) && node scripts/capture-delays.mjs
# → "captured N lines from M trains" then "inserted N observations"

# Read the aggregate back (empty until history accrues):
curl "http://localhost:3000/api/reliability?line=L6"
```

## Cost & caveats

- **Cold start.** There's no historical feed to backfill — `delay_stats` is
  empty until the cron has run for a while. Ship capture first; surface later.
- **Free-tier fit.** ~15 lines × every 10 min ≈ 2k rows/day; the 8-week window
  holds ~120k rows. Comfortably within Supabase's free tier.
- **Actions minutes.** ~1 min/run × 144 runs/day. Free on public repos; on
  private repos this uses ~14 min/day of the Actions allowance.
- **Scheduled workflows pause** after ~60 days of no repo activity — a push
  re-arms them.
- **Holidays** run a Sunday service on FGC but are currently bucketed as
  weekdays/weekends by date. A later pass can classify them via the GTFS
  calendar.

## Next step (once data exists)

`/api/reliability` is ready to consume. The highest-value surface is the trip
planner's **future-date** plans, which today get no delay estimate at all: look
up the first leg's line + departure bucket and show an expected delay. The
departures board and train detail panel are natural secondary surfaces.
