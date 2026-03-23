import type { SupabaseClient } from '@supabase/supabase-js'

export interface BusyBlockWithContext {
  id: string
  source_event_id: string
  source_event_summary: string | null
  busy_event_id: string
  source_calendar_id: string
  target_calendar_id: string
  event_start: string
  event_end: string
  created_at: string
  source_calendar: { name: string; color: string | null; account_id: string }
  target_calendar: { name: string; color: string | null; account_id: string }
}

interface GetBusyBlocksOptions {
  timeMin?: string
  timeMax?: string
  limit?: number
}

export async function getBusyBlocksForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: GetBusyBlocksOptions
): Promise<BusyBlockWithContext[]> {
  let query = supabase
    .from('managed_busy_blocks')
    .select(
      `id, source_event_id, source_event_summary, busy_event_id,
       source_calendar_id, target_calendar_id,
       event_start, event_end, created_at,
       source_calendar:calendars!source_calendar_id(name, color, account_id),
       target_calendar:calendars!target_calendar_id(name, color, account_id)`
    )
    .eq('user_id', userId)
    .order('event_start', { ascending: true })

  if (options?.timeMin) {
    query = query.gte('event_start', options.timeMin)
  }
  if (options?.timeMax) {
    query = query.lte('event_start', options.timeMax)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch busy blocks:', error)
    return []
  }

  // Supabase returns joined relations as objects (or arrays for many-to-one)
  // Normalize to ensure consistent shape
  return (data || []).map((row) => {
    const sourceCal = Array.isArray(row.source_calendar)
      ? row.source_calendar[0]
      : row.source_calendar
    const targetCal = Array.isArray(row.target_calendar)
      ? row.target_calendar[0]
      : row.target_calendar

    return {
      id: row.id,
      source_event_id: row.source_event_id,
      source_event_summary: row.source_event_summary,
      busy_event_id: row.busy_event_id,
      source_calendar_id: row.source_calendar_id,
      target_calendar_id: row.target_calendar_id,
      event_start: row.event_start,
      event_end: row.event_end,
      created_at: row.created_at,
      source_calendar: sourceCal ?? { name: 'Unknown', color: null, account_id: '' },
      target_calendar: targetCal ?? { name: 'Unknown', color: null, account_id: '' },
    }
  }) as BusyBlockWithContext[]
}
