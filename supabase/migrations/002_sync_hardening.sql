-- Per-user sync lock (advisory, row-level)
-- Prevents concurrent syncs for the same user and breaks webhook loops
create table sync_locks (
  user_id uuid primary key references auth.users on delete cascade,
  locked_at timestamptz not null default now(),
  locked_by text not null,        -- 'webhook', 'manual', 'initial'
  expires_at timestamptz not null  -- auto-expire: locked_at + 5 min
);

alter table sync_locks enable row level security;

-- Track last sync time per calendar (for webhook debounce)
alter table calendars add column last_sync_at timestamptz;
