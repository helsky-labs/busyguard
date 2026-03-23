-- Sync activity log: tracks what happened during each sync run.
-- Grouped by sync_id (one UUID per sync invocation).

create table sync_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  sync_id uuid not null,
  action text not null check (action in ('created', 'updated', 'deleted', 'error', 'skipped')),
  source_calendar_id uuid references calendars on delete set null,
  target_calendar_id uuid references calendars on delete set null,
  source_event_id text,
  busy_event_id text,
  detail text,
  created_at timestamptz default now()
);

alter table sync_activity_log enable row level security;

create policy "own_activity" on sync_activity_log
  for select using (user_id = auth.uid());

create index idx_sync_activity_user_created
  on sync_activity_log(user_id, created_at desc);
