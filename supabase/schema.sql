-- Aangan Enquiry Desk: run once in Supabase > SQL Editor.
-- Row Level Security is ON with no policies, so the public (anon) key cannot read or write anything.
-- Only the server, using the service_role key, can access these tables.

create table if not exists public.calls (
  id          text primary key,
  received_at timestamptz not null default now(),
  data        jsonb not null
);
create index if not exists calls_received_at_idx on public.calls (received_at);

create table if not exists public.seen (
  id         text primary key,
  created_at timestamptz not null default now()
);

alter table public.calls enable row level security;
alter table public.seen  enable row level security;
