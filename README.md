# Rate Card Generator - Emma Donovan

Band rate card generator with PDF export and Supabase persistence.

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
create table rate_cards (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  form_data jsonb not null,
  created_at timestamptz default now()
);

alter table rate_cards enable row level security;

create policy "Allow all access" on rate_cards
  for all using (true) with check (true);
```
