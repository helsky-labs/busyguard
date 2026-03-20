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
 */
async function createOrUpdateBusyBlock(
  admin: ReturnType<typeof createAdminClient>,
  sourceCalendar: CalendarWithAccount,
  targetCalendar: CalendarWithAccount,
  event: any,
  providerMap: Map<string, GoogleCalendarProvider>
): Promise<void> {
  // Check if block already exists
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

  const busyStart = event.start.dateTime || event.start.date
  const busyEnd = event.end.dateTime || event.end.date

  try {
    if (existing) {
      // Update if times changed
      if (
        existing.event_start !== busyStart ||
        existing.event_end !== busyEnd
      ) {
        const targetProvider = providerMap.get(targetCalendar.account_id)!
        await targetProvider.updateEvent(
          targetCalendar.provider_calendar_id,
          existing.busy_event_id,
          {
            start: event.start.dateTime ? { dateTime: busyStart } : { date: busyStart },
            end: event.end.dateTime ? { dateTime: busyEnd } : { date: busyEnd },
          }
        )

        // Update DB
        await admin
          .from('managed_busy_blocks')
          .update({
            event_start: busyStart,
            event_end: busyEnd,
          })
          .eq('id', existing.id)
      }
    } else {
      // Create new busy block
      const targetProvider = providerMap.get(targetCalendar.account_id)!
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
            },
          },
          transparency: 'opaque',
        }
      )

      // Insert record
      await admin.from('managed_busy_blocks').insert({
        user_id: sourceCalendar.user_id,
        source_event_id: event.id,
        source_calendar_id: sourceCalendar.id,
        busy_event_id: created.id,
        target_calendar_id: targetCalendar.id,
        event_start: busyStart,
        event_end: busyEnd,
      })
    }
  } catch (error) {
    console.error(
      `Error creating/updating busy block from ${sourceCalendar.name} to ${targetCalendar.name}:`,
      error
    )
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
