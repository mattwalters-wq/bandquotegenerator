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
```
