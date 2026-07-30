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
                              GET /api/reliability?lines=L6,S1  ──►  lib/reliability.ts
                                                                          │
                                                     ReliabilityNote / ReliabilityCard
                                                     in TripPlanner, DetailPanel,
                                                     DeparturesBoard
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

**3b. App environment.** The cron and the app read the same database but are
configured **separately**: the GitHub Actions secrets above drive the capture
job only. The deployed app needs the same two variables in its own hosting
environment (Vercel → Settings → Environment Variables), or it will collect
data forever and never display any of it.

This failure is silent by design — the UI renders nothing when there's no
history, so a missing variable looks exactly like "not enough data yet".
To tell them apart:

```bash
node scripts/check-reliability-health.mjs https://your-deployment
```
**4. Kick off the cron.** The workflow runs every 10 min once secrets exist.
Trigger the first run manually: GitHub → **Actions → Capture FGC delays → Run
workflow**. Check the run log for `inserted N observations`, then confirm rows
in Supabase → Table Editor → `delay_observations`.

## UI surfaces

[`lib/reliability.ts`](../src/lib/reliability.ts) owns the client side: a
module-level per-line cache exposed through `useReliability(lines)` (a
`useSyncExternalStore`, so ten cards cost one batched round trip and a cache
hit renders with no extra commit), plus the bucket lookup and phrasing rules.

Two guards decide whether we say anything at all, and both matter more than
the number itself:

- **`MIN_SAMPLES` (12)** — below roughly two hours of accumulated snapshots for
  a slot, one bad afternoon dominates the median, so we render nothing.
- **`NOISE_FLOOR` (0.5 min)** — a median under half a minute reads as "usually
  on time" rather than "+0.4 min". Negative medians (early trains) count as on
  time too.

Because both degrade to "render nothing", every surface is safe to mount before
the history exists. The surfaces:

| Where | Component | Shown when |
|---|---|---|
| Trip planner journey card | `ReliabilityNote` | Always except when a **live** delay is already displayed — so in practice it speaks up for future-date plans, which have no live figure at all. |
| Train detail panel | `ReliabilityCard` | Typical delay for that line in the current 30-min slot, plus the p90 "bad day" figure and the sample count. |
| Station departures board | inline, compact | Per row, only when that line has no live delay to report. |

The general rule: **live data wins, history fills the gaps.** Never show both
for the same train, or the user has to reconcile two numbers themselves.

## Checks

The repo has no test runner, so these are standalone Node scripts:

```bash
npm test          # bucket math + i18n coverage (pure, no network)
```

For the full chain against a stand-in Postgres — no production key needed:

```bash
node scripts/mock-supabase.mjs &                  # PostgREST-shaped fixture
SUPABASE_URL=http://127.0.0.1:54321 \
  SUPABASE_SERVICE_ROLE_KEY=test npx next start -p 3115 &
BASE=http://127.0.0.1:3115 node --experimental-strip-types \
  scripts/test-reliability-e2e.mts
```

That asserts the request contract (including that junk line names are dropped
rather than forwarded into the PostgREST filter), the payload shape, and the
exact sentence rendered to the user. Note Next.js persists its fetch cache to
`.next/cache/fetch-cache`, so clear it when changing fixture data.

And the capture side, against the real FGC feed:

```bash
export $(grep -v '^#' .env.local | xargs) && node scripts/capture-delays.mjs
# → "captured N lines from M trains" then "inserted N observations"
```

## Cost & caveats

- **Two places need credentials.** GitHub Actions secrets (capture) and the
  hosting environment (the app). Setting only the first is the most likely way
  for this feature to look broken while everything reports success;
  `scripts/check-reliability-health.mjs` diagnoses it.
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

## Possible next steps

- **Per-station, not per-line.** Delay is captured per line, but a line is late
  in one direction and at one end far more often than uniformly. Capturing
  `(line, direction)` or per-stop would sharpen the claim considerably.
- **A trend view** — the data supports "is this line getting worse?", which no
  surface asks yet.
