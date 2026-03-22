import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarProvider, type GoogleEvent } from '@/lib/providers/google'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'
import { acquireSyncLock, releaseSyncLock } from '@/lib/sync-lock'
import type { CalendarAccountCredentials } from '@/lib/types'

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
 * Layer 1+2: Detect if an event is one we manage (loop prevention).
 * Layer 1: Extended properties (works when Google returns them).
 * Layer 2: Content markers (works even if extended properties stripped).
 */
export function isManagedEvent(event: GoogleEvent): boolean {
  // Layer 1: Extended properties
  if (event.extendedProperties?.private?.busyguard === 'managed') return true
  // Layer 2: Summary + description pattern
  if (event.summary === 'Busy' && event.description?.includes('[BusyGuard]')) return true
  return false
}

/**
 * Main sync engine: creates and manages busy blocks across calendars.
 * Runs as admin (bypasses RLS) since it's not triggered within a user session.
 *
 * Loop prevention layers:
 *   1. Extended properties filter (extendedProperties.private.busyguard)
 *   2. Content markers filter (summary=Busy + description contains [BusyGuard])
 *   3. DB reverse lookup (event ID in managed_busy_blocks.busy_event_id)
 *   4. Per-user sync lock (prevents concurrent syncs)
 *   5. Description marker on created events (gives Layer 2 something to match)
 */
export async function syncCalendars(
  userId: string,
  source: 'webhook' | 'manual' | 'initial' = 'manual'
): Promise<void> {
  // Layer 4: Sync lock
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

  // Layer 3: DB reverse lookup — build set of all busy_event_ids we manage
  const { data: managedEventRows } = await admin
    .from('managed_busy_blocks')
    .select('busy_event_id')
    .eq('user_id', userId)
  const managedEventIds = new Set(
    managedEventRows?.map((r) => r.busy_event_id) ?? []
  )

  // 3. Process each source calendar
  const timeMin = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

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
        // Layer 1+2: Extended properties + content marker filter
        if (isManagedEvent(event)) continue
        // Layer 3: DB reverse lookup — this event IS a busy block we created
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
            providerMap
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

  // 4. Cleanup orphaned blocks
  await cleanupOrphanedBlocks(admin, userId, liveEventIds, providerMap)

  // 5. Update last_sync_at on all included calendars
  const calendarIds = typedCalendars.map((c) => c.id)
  await admin
    .from('calendars')
    .update({ last_sync_at: new Date().toISOString() })
    .in('id', calendarIds)
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
  providerMap: Map<string, GoogleCalendarProvider>
): Promise<void> {
  const busyStart = event.start.dateTime || event.start.date
  const busyEnd = event.end.dateTime || event.end.date
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

    // 3. Check for orphaned events on Google Calendar
    const orphanedEvent = await findOrphanedEvent(
      targetProvider,
      targetCalendar.provider_calendar_id,
      event.id,
      busyStart,
      busyEnd
    )

    let busyEventId: string

    if (orphanedEvent) {
      busyEventId = orphanedEvent.id
      logger.info('Found orphaned busy event, reusing', {
        busyEventId,
        sourceEventId: event.id,
      })
    } else {
      // Layer 5: Description marker — gives Layer 2 something to match
      const created = await targetProvider.createEvent(
        targetCalendar.provider_calendar_id,
        {
          summary: 'Busy',
          start: event.start.dateTime
            ? { dateTime: busyStart, timeZone: event.start.timeZone }
            : { date: busyStart },
          end: event.end.dateTime
            ? { dateTime: busyEnd, timeZone: event.end.timeZone }
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
      busyEventId = created.id
    }

    // 4. Insert DB record
    const { error: insertError } = await admin.from('managed_busy_blocks').insert({
      user_id: sourceCalendar.user_id,
      source_event_id: event.id,
      source_calendar_id: sourceCalendar.id,
      busy_event_id: busyEventId,
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
  } catch (error) {
    logger.error('Error creating/updating busy block', {
      source: sourceCalendar.name,
      target: targetCalendar.name,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function findOrphanedEvent(
  provider: GoogleCalendarProvider,
  calendarId: string,
  sourceEventId: string,
  busyStart: string,
  busyEnd: string
): Promise<GoogleEvent | null> {
  try {
    const isAllDay = !busyStart.includes('T')
    const searchStart = new Date(busyStart)
    const searchEnd = new Date(busyEnd)

    if (isAllDay) {
      searchStart.setDate(searchStart.getDate() - 1)
      searchEnd.setDate(searchEnd.getDate() + 1)
    } else {
      searchStart.setHours(searchStart.getHours() - 1)
      searchEnd.setHours(searchEnd.getHours() + 1)
    }

    const events = await provider.listEvents(
      calendarId,
      searchStart.toISOString(),
      searchEnd.toISOString()
    )

    return events.find(
      (e) =>
        e.extendedProperties?.private?.busyguard === 'managed' &&
        e.extendedProperties?.private?.sourceEventId === sourceEventId
    ) ?? null
  } catch (error) {
    logger.error('Error searching for orphaned event', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

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
    if (!liveEventIds.has(block.source_event_id)) {
      try {
        const targetCal = block.calendars as { account_id: string; provider_calendar_id: string }
        const provider = providerMap.get(targetCal.account_id)!
        await provider.deleteEvent(
          targetCal.provider_calendar_id,
          block.busy_event_id
        )

        await admin.from('managed_busy_blocks').delete().eq('id', block.id)
      } catch (error) {
        logger.error('Error cleaning up block', {
          blockId: block.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
}

function buildProvider(
  account: CalendarAccountCredentials
): GoogleCalendarProvider {
  return new GoogleCalendarProvider(
    serverEnv.GOOGLE_CLIENT_ID,
    serverEnv.GOOGLE_CLIENT_SECRET,
    serverEnv.GOOGLE_REDIRECT_URI,
    account.access_token,
    account.refresh_token ?? undefined
  )
}
