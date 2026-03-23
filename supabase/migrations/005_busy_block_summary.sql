-- Store source event summary in managed_busy_blocks for timeline display.
-- Existing rows will have NULL; new syncs populate going forward.

alter table managed_busy_blocks
  add column source_event_summary text;
