-- Migration: OpenAI OAuth connection storage
-- Stores user OAuth tokens and device code sessions for ChatGPT integration.

-- ---------------------------------------------------------------------------
-- openai_connections: stores OAuth tokens or manual API keys per user
-- ---------------------------------------------------------------------------
create table if not exists public.openai_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auth_method text not null default 'manual' check (auth_method in ('manual', 'oauth-device')),
  api_key text,
  access_token text,
  refresh_token text,
  id_token text,
  token_expires_at timestamptz,
  email text,
  account_id text,
  plan_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint openai_connections_user_id_unique unique (user_id)
);

-- ---------------------------------------------------------------------------
-- openai_device_sessions: temporary device code sessions during OAuth flow
-- ---------------------------------------------------------------------------
create table if not exists public.openai_device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_auth_id text not null,
  user_code text not null,
  code_verifier text,
  verification_url text not null,
  expires_at timestamptz not null,
  poll_interval integer not null default 5,
  status text not null default 'pending' check (status in ('pending', 'authorized', 'expired')),
  created_at timestamptz not null default now(),
  constraint openai_device_sessions_user_id_unique unique (user_id)
);

-- ---------------------------------------------------------------------------
-- RLS policies: users can only access their own rows
-- ---------------------------------------------------------------------------
alter table public.openai_connections enable row level security;
alter table public.openai_device_sessions enable row level security;

create policy "Users can view their own OpenAI connection"
  on public.openai_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert their own OpenAI connection"
  on public.openai_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own OpenAI connection"
  on public.openai_connections for update
  using (auth.uid() = user_id);

create policy "Users can delete their own OpenAI connection"
  on public.openai_connections for delete
  using (auth.uid() = user_id);

create policy "Users can view their own device session"
  on public.openai_device_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own device session"
  on public.openai_device_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own device session"
  on public.openai_device_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own device session"
  on public.openai_device_sessions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger for openai_connections
-- ---------------------------------------------------------------------------
create or replace function public.handle_openai_connections_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger openai_connections_updated_at
  before update on public.openai_connections
  for each row execute function public.handle_openai_connections_updated_at();

-- ---------------------------------------------------------------------------
-- Cleanup function for expired device sessions
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_expired_device_sessions()
returns void as $$
begin
  delete from public.openai_device_sessions
  where expires_at < now();
end;
$$ language plpgsql security definer;
