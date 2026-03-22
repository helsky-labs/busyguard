import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarProvider, createGoogleProvider, type GoogleEvent } from '@/lib/providers/google'
import { logger } from '@/lib/logger'
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync-lock'
import type { CalendarAccountCredentials } from '@/lib/types'

/**
 * How far ahead (in days) to sync events. Controls the maximum number of
 * busy blocks created per calendar pair. Configurable via env var.
 *
 * 14 days = ~10-20 busy blocks per pair (typical meeting density).
 * Increasing this linearly increases the number of managed events.
 */
const SYNC_AHEAD_DAYS = parseInt(process.env.BUSYGUARD_SYNC_AHEAD_DAYS || '14', 10)
const SYNC_LOOKBACK_DAYS = 3

interface CalendarWithAccount {
  id: string
  account_id: string
  user_id: string
  provider_calendar_id: string
  name: string
  is_included: boolean
  color?: string
  calendar_accounts: CalendarAccountCredentials | CalendarAccountCredentials[]
}

/**
 * Main sync engine: creates and manages busy blocks across calendars.
 * Runs as admin (bypasses RLS) since it's not triggered within a user session.
 *
 * Loop prevention:
 *   The ONLY reliable check is the DB reverse lookup — checking if an event's
 *   Google ID exists as `busy_event_id` in managed_busy_blocks. Google Workspace
 *   silently strips extendedProperties, summary, and description from events
 *   we create, so metadata-based detection is unreliable.
 *
 *   The sync lock prevents concurrent syncs for the same user.
 */
export async function syncCalendars(
  userId: string,
  source: 'webhook' | 'manual' | 'initial' = 'manual'
): Promise<void> {
  const locked = await acquireSyncLock(userId, source)
  if (!locked) {
    logger.info('Sync already running, skipping', { userId, source })
    return
  }

  try {
    await doSync(userId)
  } finally {
    await releaseSyncLock(userId)
  }
}

async function doSync(userId: string): Promise<void> {
  const admin = createAdminClient()

  // 1. Fetch all included calendars with their account credentials
  const { data: calendars, error: calendarsError } = await admin
    .from('calendars')
    .select(
      `id, account_id, user_id, provider_calendar_id, name, is_included, color,
       calendar_accounts(access_token, refresh_token)`
    )
    .eq('user_id', userId)
    .eq('is_included', true)

  if (calendarsError) {
    logger.error('Failed to fetch calendars', { error: calendarsError })
    throw calendarsError
  }

  if (!calendars || calendars.length === 0) {
    logger.info('No included calendars found', { userId })
    return
  }

  const typedCalendars = calendars as CalendarWithAccount[]

  // 2. Build provider map: account_id → GoogleCalendarProvider
  const providerMap = new Map<string, GoogleCalendarProvider>()

  for (const cal of typedCalendars) {
    if (!providerMap.has(cal.account_id)) {
      const accountData = Array.isArray(cal.calendar_accounts)
        ? cal.calendar_accounts[0]
        : cal.calendar_accounts
      providerMap.set(cal.account_id, buildProvider(accountData))
    }
  }

  // DB reverse lookup — build set of ALL busy_event_ids we've ever created.
  // This is the ONLY reliable loop detection. We include all rows (even for
  // events we've already deleted from Google) to handle Google's eventual
  // consistency — a deleted event may still appear in listings briefly.
  const { data: managedEventRows } = await admin
    .from('managed_busy_blocks')
    .select('busy_event_id')
    .eq('user_id', userId)
  const managedEventIds = new Set(
    managedEventRows?.map((r) => r.busy_event_id) ?? []
  )

  logger.info('Sync starting', {
    userId,
    calendars: typedCalendars.length,
    managedEventIds: managedEventIds.size,
    syncAheadDays: SYNC_AHEAD_DAYS,
  })

  // 3. Process each source calendar within the sync period
  const timeMin = new Date(Date.now() - SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(Date.now() + SYNC_AHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const liveEventIds = new Set<string>()

  for (const sourceCalendar of typedCalendars) {
    try {
      const provider = providerMap.get(sourceCalendar.account_id)!
      const events = await provider.listEvents(
        sourceCalendar.provider_calendar_id,
        timeMin,
        timeMax
      )

      for (const event of events) {
        // DB reverse lookup: if this event's Google ID is one we created
        // as a busy block, skip it. This is the ONLY loop detection we trust.
        if (managedEventIds.has(event.id)) continue

        liveEventIds.add(event.id)

        // Create busy blocks on all other calendars
        for (const targetCalendar of typedCalendars) {
          if (targetCalendar.id === sourceCalendar.id) continue

          await createOrUpdateBusyBlock(
            admin,
            sourceCalendar,
            targetCalendar,
            event,
            providerMap,
            managedEventIds
          )
        }
      }
    } catch (error) {
      logger.error('Error syncing calendar', {
        calendarId: sourceCalendar.provider_calendar_id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // 4. Cleanup orphaned blocks (source event deleted)
  await cleanupOrphanedBlocks(admin, userId, liveEventIds, providerMap)

  // 5. Update last_sync_at on all included calendars
  const calendarIds = typedCalendars.map((c) => c.id)
  await admin
    .from('calendars')
    .update({ last_sync_at: new Date().toISOString() })
    .in('id', calendarIds)

  logger.info('Sync complete', { userId, liveEvents: liveEventIds.size })
}

/**
 * Create or update a busy block on target calendar.
 * IDEMPOTENT: Safe to call multiple times for the same event.
 */
async function createOrUpdateBusyBlock(
  admin: ReturnType<typeof createAdminClient>,
  sourceCalendar: CalendarWithAccount,
  targetCalendar: CalendarWithAccount,
  event: GoogleEvent,
  providerMap: Map<string, GoogleCalendarProvider>,
  managedEventIds: Set<string>
): Promise<void> {
  const busyStart = (event.start.dateTime || event.start.date)!
  const busyEnd = (event.end.dateTime || event.end.date)!
  const targetProvider = providerMap.get(targetCalendar.account_id)!

  try {
    // 1. Check database first (source of truth)
    const { data: existing, error: existingError } = await admin
      .from('managed_busy_blocks')
      .select('*')
      .eq('source_event_id', event.id)
      .eq('source_calendar_id', sourceCalendar.id)
      .eq('target_calendar_id', targetCalendar.id)
      .maybeSingle()

    if (existingError) {
      logger.error('Error checking existing busy block', { error: existingError })
      return
    }

    // 2. If DB record exists, update Google Calendar if times changed
    if (existing) {
      if (
        existing.event_start !== busyStart ||
        existing.event_end !== busyEnd
      ) {
        await targetProvider.updateEvent(
          targetCalendar.provider_calendar_id,
          existing.busy_event_id,
          {
            start: event.start.dateTime ? { dateTime: busyStart } : { date: busyStart },
            end: event.end.dateTime ? { dateTime: busyEnd } : { date: busyEnd },
          }
        )

        await admin
          .from('managed_busy_blocks')
          .update({ event_start: busyStart, event_end: busyEnd })
          .eq('id', existing.id)
      }
      return
    }

    // 3. Create new busy block on Google Calendar.
    //    We still set metadata (summary, description, extendedProperties) because
    //    it works on personal Gmail. Workspace strips it, but that's fine — we
    //    don't rely on it for loop detection anymore.
    const created = await targetProvider.createEvent(
      targetCalendar.provider_calendar_id,
      {
        summary: 'Busy',
        start: event.start.dateTime
          ? { dateTime: busyStart, timeZone: event.start.timeZone ?? undefined }
          : { date: busyStart },
        end: event.end.dateTime
          ? { dateTime: busyEnd, timeZone: event.end.timeZone ?? undefined }
          : { date: busyEnd },
        extendedProperties: {
          private: {
            busyguard: 'managed',
            sourceEventId: event.id,
          },
        },
        transparency: 'opaque',
        description: '[BusyGuard] Managed by BusyGuard — do not edit',
      }
    )

    // 4. Insert DB record THEN add to in-memory set.
    //    The DB record MUST exist before any webhook can trigger a new sync,
    //    so the new event's ID is recognized as managed.
    const { error: insertError } = await admin.from('managed_busy_blocks').insert({
      user_id: sourceCalendar.user_id,
      source_event_id: event.id,
      source_calendar_id: sourceCalendar.id,
      busy_event_id: created.id,
      target_calendar_id: targetCalendar.id,
      event_start: busyStart,
      event_end: busyEnd,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        logger.info('Race condition: DB record already exists', {
          sourceEventId: event.id,
          targetCalendar: targetCalendar.name,
        })
      } else {
        logger.error('Unexpected error inserting busy block', { error: insertError })
      }
    }

    // Update in-memory set so any subsequent calendar in this same sync
    // iteration recognizes this event as managed
    managedEventIds.add(created.id)
  } catch (error) {
    logger.error('Error creating/updating busy block', {
      source: sourceCalendar.name,
      target: targetCalendar.name,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Delete busy blocks whose source events no longer exist.
 *
 * Deletes the Google Calendar event but KEEPS the DB row. This prevents a
 * race condition where Google's eventual consistency shows the "deleted"
 * event in a subsequent listing — without the DB row, the sync engine
 * would treat it as a real event and recreate it (loop).
 *
 * Stale DB rows (pointing to deleted Google events) are harmless — they
 * just add IDs to managedEventIds that never match anything.
 */
async function cleanupOrphanedBlocks(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  liveEventIds: Set<string>,
  providerMap: Map<string, GoogleCalendarProvider>
): Promise<void> {
  const { data: allBlocks, error: blocksError } = await admin
    .from('managed_busy_blocks')
    .select(
      `id, source_event_id, busy_event_id, target_calendar_id,
       calendars!target_calendar_id(account_id, provider_calendar_id)`
    )
    .eq('user_id', userId)

  if (blocksError) {
    logger.error('Error fetching managed blocks', { error: blocksError })
    return
  }

  for (const block of allBlocks || []) {
    if (liveEventIds.has(block.source_event_id)) continue

    try {
      const calData = block.calendars as unknown as { account_id: string; provider_calendar_id: string } | { account_id: string; provider_calendar_id: string }[]
      const targetCal = Array.isArray(calData) ? calData[0] : calData
      const provider = providerMap.get(targetCal.account_id)
      if (!provider) continue

      await provider.deleteEvent(
        targetCal.provider_calendar_id,
        block.busy_event_id
      )

      logger.info('Deleted orphaned busy block from Google', {
        busyEventId: block.busy_event_id,
        sourceEventId: block.source_event_id,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      // 404/410 = already deleted from Google, which is fine
      if (!msg.includes('404') && !msg.includes('410') && !msg.includes('Gone')) {
        logger.error('Error deleting orphaned block from Google', {
          blockId: block.id,
          error: msg,
        })
      }
    }
    // DB row is intentionally kept — see function docstring
  }
}

function buildProvider(account: CalendarAccountCredentials): GoogleCalendarProvider {
  return createGoogleProvider(account.access_token, account.refresh_token)
}
