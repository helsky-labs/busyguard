-- User-level settings (sync range, busy block label, auto-sync toggle)
create table user_settings (
  user_id uuid primary key references auth.users not null,
  sync_ahead_days integer not null default 3 check (sync_ahead_days in (3, 7, 30)),
  busy_block_title text not null default 'Busy' check (char_length(busy_block_title) between 1 and 50),
  auto_sync_enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table user_settings enable row level security;
create policy "own settings" on user_settings using (user_id = auth.uid());
create policy "insert own settings" on user_settings for insert with check (user_id = auth.uid());
create policy "update own settings" on user_settings for update using (user_id = auth.uid());
