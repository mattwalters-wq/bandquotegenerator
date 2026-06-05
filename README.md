# Emma Donovan - Band Quotes

Tool for pricing the band Emma hires for a show. Two modes:

- **Quick Quote** (default) - the simple, mobile-first "Emma mode": pick where, when
  and the lineup, and see the all-in band cost for every lineup side by side, with a
  plain-English breakdown and a shareable read-only link.
- **Pro** - the manager tools: AI chat, rate card editor, saved cards, PDF export and
  email generation.

All fee calculations read from a single source of truth: `lib/policy.js`. Change a
rate there and it changes everywhere (chat, editor and Quick Quote).

## Setup

### 1. Supabase
- Create a new project at supabase.com
- Run the SQL below in the SQL Editor
- Copy your project URL and anon key

### 2. Vercel
- Push this repo to GitHub
- Import to Vercel
- Add environment variables
- Deploy

## Supabase SQL

```sql
-- Saved rate cards (Pro mode)
create table rate_cards (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  form_data jsonb not null,
  created_at timestamptz default now()
);

alter table rate_cards enable row level security;

create policy "Allow all access" on rate_cards
  for all using (true) with check (true);

-- Shared Quick Quotes (read-only links at /q/<id>)
create table quotes (
  id uuid default gen_random_uuid() primary key,
  data jsonb not null,
  created_at timestamptz default now()
);

alter table quotes enable row level security;

create policy "Allow all access" on quotes
  for all using (true) with check (true);

-- View preference (Quick Quote vs Pro) per browser session
create table session_prefs (
  session_id text primary key,
  view text not null default 'quick',
  updated_at timestamptz default now()
);

alter table session_prefs enable row level security;

create policy "Allow all access" on session_prefs
  for all using (true) with check (true);

-- Band roster - each member's home base drives their per-player travel days
create table band_members (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  instrument text,
  home_base text not null default 'Melbourne',
  gst_registered boolean not null default false,
  created_at timestamptz default now()
);

alter table band_members enable row level security;

create policy "Allow all access" on band_members
  for all using (true) with check (true);

-- Cache of AI door-to-door estimates, keyed by origin+destination+show time
create table travel_estimates (
  cache_key text primary key,
  origin text not null,
  destination text not null,
  show_time text,
  estimate jsonb not null,
  created_at timestamptz default now()
);

alter table travel_estimates enable row level security;

create policy "Allow all access" on travel_estimates
  for all using (true) with check (true);
```

## Travel day engine

The app works out travel days itself - users never need to know the policy.

- `lib/policy.js` - `countTravelDays(itinerary, playerHomeBase)`: the pure rule
  engine (the rule is in `TRAVEL_DAY_RULE_TEXT`, injected into the AI chat prompt too).
- `lib/travelData.js` - static door-to-door estimates (capitals, Gold Coast,
  known regional towns) plus a regional fallback (gateway airport + drive hours).
- `lib/itinerary.js` - infers a sensible per-player itinerary, then counts travel
  days; `validateTravelEstimate` strictly validates the AI fallback JSON.
- `app/api/travel-estimate` - Anthropic fallback for unknown destinations,
  returns strict validated JSON only, cached in `travel_estimates`.

Run the tests:

```bash
npm test
```
