import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarProvider } from '@/lib/providers/google'

interface CalendarWithAccount {
  id: string
  account_id: string
  user_id: string
  provider_calendar_id: string
  name: string
  is_included: boolean
  color?: string
  calendar_accounts: any // Supabase returns nested relations
}

interface ManagedBusyBlock {
  id: string
  source_event_id: string
  source_calendar_id: string
  busy_event_id: string
  target_calendar_id: string
  event_start: string
  event_end: string
}

/**
 * Main sync engine: creates and manages busy blocks across calendars
 * Runs as admin (bypasses RLS) since it's not triggered within a user session
 */
export async function syncCalendars(userId: string): Promise<void> {
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
    console.error('Failed to fetch calendars:', calendarsError)
    throw calendarsError
  }

  if (!calendars || calendars.length === 0) {
    console.log('No included calendars found for user:', userId)
    return
  }

  const typedCalendars = calendars as CalendarWithAccount[]

  // 2. Build provider map: account_id → GoogleCalendarProvider
  const providerMap = new Map<string, GoogleCalendarProvider>()
  const accountMap = new Map<string, CalendarWithAccount[]>()

  for (const cal of typedCalendars) {
    const accountId = cal.account_id
    if (!providerMap.has(accountId)) {
      // Supabase nested select returns the relation, potentially as an array
      const accountData = Array.isArray(cal.calendar_accounts)
        ? cal.calendar_accounts[0]
        : cal.calendar_accounts
      const provider = buildProvider(accountData)
      providerMap.set(accountId, provider)
    }

    if (!accountMap.has(accountId)) {
      accountMap.set(accountId, [])
    }
    accountMap.get(accountId)!.push(cal)
  }

  // 3. Process each source calendar
  const timeMin = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // -3 days
  const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // +90 days

  const liveEventIds = new Set<string>()

  for (const sourceCalendar of typedCalendars) {
    try {
      const provider = providerMap.get(sourceCalendar.account_id)!
      const events = await provider.listEvents(
        sourceCalendar.provider_calendar_id,
        timeMin,
        timeMax
      )

      // Filter out events we created (loop prevention)
      const realEvents = events.filter(
        (e) => e.extendedProperties?.private?.busyguard !== 'managed'
      )

      // Process each real event
      for (const event of realEvents) {
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
      console.error(
        `Error syncing calendar ${sourceCalendar.provider_calendar_id}:`,
        error
      )
      // Continue with other calendars on error
    }
  }

  // 4. Cleanup orphaned blocks
  await cleanupOrphanedBlocks(admin, userId, liveEventIds, providerMap)
}

/**
 * Create or update a busy block on target calendar
 * IDEMPOTENT: Safe to call multiple times for the same event
 */
async function createOrUpdateBusyBlock(
  admin: ReturnType<typeof createAdminClient>,
  sourceCalendar: CalendarWithAccount,
  targetCalendar: CalendarWithAccount,
  event: any,
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
      console.error('Error checking existing busy block:', existingError)
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

        // Update DB record
        await admin
          .from('managed_busy_blocks')
          .update({
            event_start: busyStart,
            event_end: busyEnd,
          })
          .eq('id', existing.id)
      }
      return
    }

    // 3. No DB record exists. Check Google Calendar for orphaned events
    // (events created by us but no DB record - e.g., from a previous crash)
    // Only check events in the relevant time range for performance
    const orphanedEvent = await findOrphanedEvent(
      targetProvider,
      targetCalendar.provider_calendar_id,
      event.id,
      busyStart,
      busyEnd
    )

    let busyEventId: string

    if (orphanedEvent) {
      // Event exists on Google Calendar but not in DB - reuse it and log it
      busyEventId = orphanedEvent.id
      console.log(
        `Found orphaned busy event ${busyEventId} for source ${event.id}, reusing it`
      )
    } else {
      // Create new event
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
          description: 'Managed by BusyGuard',
        }
      )
      busyEventId = created.id
    }

    // 4. Insert DB record (should always succeed, unless race condition)
    // If it fails with 23505, another sync created it - that's OK
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
        // Race condition: another sync created this record between our check and insert
        // This is harmless - the other sync's event ID is in the DB
        console.log(
          `Race condition for ${event.id} on ${targetCalendar.name}: DB record already exists`
        )
      } else {
        console.error('Unexpected error inserting busy block:', insertError)
      }
    }
  } catch (error) {
    console.error(
      `Error creating/updating busy block from ${sourceCalendar.name} to ${targetCalendar.name}:`,
      error
    )
  }
}

/**
 * Find an orphaned managed event on Google Calendar for this source event
 * Only checks events within the date range for performance
 */
async function findOrphanedEvent(
  provider: GoogleCalendarProvider,
  calendarId: string,
  sourceEventId: string,
  busyStart: string,
  busyEnd: string
): Promise<any> {
  try {
    // Calculate a reasonable search window around the event times
    // For all-day events, expand the range; for timed events, be tighter
    const isAllDay = !busyStart.includes('T')
    const searchStart = new Date(busyStart)
    const searchEnd = new Date(busyEnd)

    if (isAllDay) {
      // For all-day events, search 1 day before and after
      searchStart.setDate(searchStart.getDate() - 1)
      searchEnd.setDate(searchEnd.getDate() + 1)
    } else {
      // For timed events, search 1 hour before and after
      searchStart.setHours(searchStart.getHours() - 1)
      searchEnd.setHours(searchEnd.getHours() + 1)
    }

    const timeMin = searchStart.toISOString()
    const timeMax = searchEnd.toISOString()

    const events = await provider.listEvents(calendarId, timeMin, timeMax)

    // Find our managed event with this sourceEventId
    const orphaned = events.find(
      (e) =>
        e.extendedProperties?.private?.busyguard === 'managed' &&
        e.extendedProperties?.private?.sourceEventId === sourceEventId
    )

    return orphaned
  } catch (error) {
    console.error(`Error searching for orphaned event:`, error)
    return null
  }
}

/**
 * Delete busy blocks whose source events no longer exist
 */
async function cleanupOrphanedBlocks(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  liveEventIds: Set<string>,
  providerMap: Map<string, GoogleCalendarProvider>
): Promise<void> {
  // Get all managed blocks for user
  const { data: allBlocks, error: blocksError } = await admin
    .from('managed_busy_blocks')
    .select(
      `id, source_event_id, busy_event_id, target_calendar_id,
       calendars!target_calendar_id(account_id, provider_calendar_id)`
    )
    .eq('user_id', userId)

  if (blocksError) {
    console.error('Error fetching managed blocks:', blocksError)
    return
  }

  for (const block of allBlocks || []) {
    if (!liveEventIds.has(block.source_event_id)) {
      try {
        const targetCal = (block.calendars as any)
        const provider = providerMap.get(targetCal.account_id)!
        await provider.deleteEvent(
          targetCal.provider_calendar_id,
          block.busy_event_id
        )

        // Delete from DB
        await admin.from('managed_busy_blocks').delete().eq('id', block.id)
      } catch (error) {
        console.error(`Error cleaning up block ${block.id}:`, error)
      }
    }
  }
}

/**
 * Helper: build a provider from account credentials
 */
function buildProvider(
  account: { access_token: string; refresh_token?: string | null }
): GoogleCalendarProvider {
  return new GoogleCalendarProvider(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
    account.access_token,
    account.refresh_token ?? undefined
  )
}
