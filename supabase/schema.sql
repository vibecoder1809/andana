-- Andana · reliability history schema
-- Run once in the Supabase SQL editor (SQL → New query → paste → Run).
-- Safe to re-run: everything is idempotent.

-- Raw capture: one row per line per snapshot (~every 10 min from the GitHub
-- Action). delay_min is the median live delay across that line's running
-- trains; it can be negative (early). sample_count = how many trains fed it.
create table if not exists delay_observations (
  id           bigint generated always as identity primary key,
  line         text        not null,
  delay_min    real        not null,
  sample_count int         not null,
  observed_at  timestamptz not null default now()
);

create index if not exists delay_observations_line_time
  on delay_observations (line, observed_at desc);

-- Lock the raw table: RLS on with no policies denies anon/authenticated
-- entirely. The capture job and our server API use the service_role key, which
-- bypasses RLS — so nothing else can read or write these rows.
alter table delay_observations enable row level security;

-- Aggregated curve the app reads: median + p90 delay per line, split by
-- weekday/weekend, in 30-minute local-time buckets, over a rolling 8-week
-- window. Times are converted to Europe/Madrid so the buckets line up with the
-- real timetable across DST.
create or replace view delay_stats as
select
  line,
  case when extract(dow from observed_at at time zone 'Europe/Madrid') in (0, 6)
       then 'weekend' else 'weekday' end                                     as day_type,
  (floor((extract(hour   from observed_at at time zone 'Europe/Madrid') * 60
        + extract(minute from observed_at at time zone 'Europe/Madrid')) / 30) * 30)::int as bucket_min,
  round(percentile_cont(0.5) within group (order by delay_min)::numeric, 1)  as median_delay,
  round(percentile_cont(0.9) within group (order by delay_min)::numeric, 1)  as p90_delay,
  count(*)                                                                   as samples
from delay_observations
where observed_at > now() - interval '56 days'
group by line, day_type, bucket_min;

-- Note: day_type is weekday/weekend only for v1. Public holidays (which run a
-- Sunday service on FGC) are not yet special-cased — a later pass can join the
-- GTFS calendar to classify them.
