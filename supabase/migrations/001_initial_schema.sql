-- Connected calendar accounts (Google, Microsoft per user)
create table calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  provider text not null check (provider in ('google', 'microsoft')),
  provider_account_id text not null,  -- email or user ID from provider
  email text not null,
  display_name text,
  access_token text not null,    -- store via Supabase Vault
  refresh_token text,             -- store via Supabase Vault
  token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider, provider_account_id)
);

-- Individual calendars within an account
create table calendars (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references calendar_accounts on delete cascade not null,
  user_id uuid references auth.users not null,
  provider_calendar_id text not null,  -- calendar ID from provider
  name text not null,
  is_included boolean default true,    -- participates in sync
  color text,
  created_at timestamptz default now(),
  unique (account_id, provider_calendar_id)
);

-- Active webhook/push notification subscriptions
create table webhook_channels (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references calendars on delete cascade not null,
  provider text not null,
  channel_id text,        -- Google channel ID / Microsoft subscription ID
  resource_id text,       -- Google resource ID
  expiry timestamptz not null,
  created_at timestamptz default now()
);

-- Core tracking: which busy blocks we created and where
create table managed_busy_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  source_event_id text not null,        -- provider event ID in source calendar
  source_calendar_id uuid references calendars on delete cascade not null,
  busy_event_id text not null,          -- provider event ID of created busy block
  target_calendar_id uuid references calendars on delete cascade not null,
  event_start timestamptz not null,
  event_end timestamptz not null,
  created_at timestamptz default now(),
  unique (source_event_id, source_calendar_id, target_calendar_id)
);

-- Enable RLS on all tables
alter table calendar_accounts enable row level security;
alter table calendars enable row level security;
alter table webhook_channels enable row level security;
alter table managed_busy_blocks enable row level security;

-- RLS policies: users can only see their own data
create policy "own accounts" on calendar_accounts using (user_id = auth.uid());
create policy "own calendars" on calendars using (user_id = auth.uid());
create policy "own channels" on webhook_channels using (
  calendar_id in (select id from calendars where user_id = auth.uid())
);
create policy "own blocks" on managed_busy_blocks using (user_id = auth.uid());

-- Indexes for common queries
create index idx_calendar_accounts_user on calendar_accounts(user_id);
create index idx_calendars_account on calendars(account_id);
create index idx_calendars_user on calendars(user_id);
create index idx_webhook_channels_calendar on webhook_channels(calendar_id);
create index idx_webhook_channels_expiry on webhook_channels(expiry);
create index idx_managed_busy_blocks_user on managed_busy_blocks(user_id);
create index idx_managed_busy_blocks_source on managed_busy_blocks(source_event_id, source_calendar_id);
create index idx_managed_busy_blocks_target on managed_busy_blocks(target_calendar_id);
