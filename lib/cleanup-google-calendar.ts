import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarProvider } from '@/lib/providers/google'
import { serverEnv } from '@/lib/env'

/**
 * NUCLEAR OPTION: Delete ALL "Busy" and "(No title)" events from included calendars
 * Starts fresh - next sync will recreate events cleanly
 */
export async function nuclearCleanup(userId: string): Promise<void> {
  const admin = createAdminClient()

  console.log('🔴 NUCLEAR CLEANUP: Deleting ALL "Busy" and "(No title)" events...')

  // 1. Fetch only INCLUDED calendars
  const { data: calendars, error: calError } = await admin
    .from('calendars')
    .select(
      `id, account_id, provider_calendar_id, name,
       calendar_accounts(access_token, refresh_token)`
    )
    .eq('user_id', userId)
    .eq('is_included', true)

  if (calError) {
    console.error('Failed to fetch calendars:', calError)
    throw calError
  }

  if (!calendars || calendars.length === 0) {
    console.log('No calendars found')
    return
  }

  // Build provider map
  const providerMap = new Map<string, GoogleCalendarProvider>()
  for (const cal of calendars) {
    if (!providerMap.has(cal.account_id)) {
      const accountData = Array.isArray(cal.calendar_accounts)
        ? cal.calendar_accounts[0]
        : cal.calendar_accounts

      const provider = new GoogleCalendarProvider(
        serverEnv.GOOGLE_CLIENT_ID,
        serverEnv.GOOGLE_CLIENT_SECRET,
        serverEnv.GOOGLE_REDIRECT_URI,
        accountData.access_token,
        accountData.refresh_token ?? undefined
      )
      providerMap.set(cal.account_id, provider)
    }
  }

  // 2. Delete ALL "Busy" and "(No title)" events
  let totalDeleted = 0

  for (const cal of calendars) {
    try {
      console.log(`\nProcessing calendar: ${cal.name}`)

      const provider = providerMap.get(cal.account_id)!

      // List all events in a wide range
      const timeMin = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()

      const events = await provider.listEvents(cal.provider_calendar_id, timeMin, timeMax)

      // Find ALL "Busy" and "(No title)" events (very aggressive)
      const toDelete = events.filter((e) => {
        // Delete if "Busy"
        if (e.summary === 'Busy') return true
        // Delete if no summary (renders as "(No title)")
        if (!e.summary || e.summary?.trim() === '') return true
        // Delete if literally says "(No title)"
        if (e.summary === '(No title)') return true
        // Delete if it's one of our managed events
        if (e.description?.includes('Managed by BusyGuard')) return true
        if (e.extendedProperties?.private?.busyguard === 'managed') return true
        return false
      })

      console.log(`Found ${toDelete.length} events to delete`)

      for (const event of toDelete) {
        try {
          await provider.deleteEvent(cal.provider_calendar_id, event.id)
          console.log(
            `  ✓ Deleted: "${event.summary || '(No title)'}" at ${event.start.dateTime || event.start.date}`
          )
          totalDeleted++
        } catch (error) {
          if ((error as any)?.code === 410) {
            console.log(`  ✓ Already deleted`)
          } else {
            console.error(`  ✗ Failed to delete ${event.id}:`, error)
          }
        }
      }

      console.log(`Deleted ${toDelete.length} events from ${cal.name}`)
    } catch (error) {
      console.error(`Error processing calendar ${cal.name}:`, error)
    }
  }

  console.log(`\n🔴 NUCLEAR CLEANUP COMPLETE! Deleted ${totalDeleted} events`)
  console.log('Next sync will recreate all events cleanly.')
}

/**
 * Aggressively clean up ALL duplicate "Busy" events from Google Calendar
 * Groups by time slot and keeps only ONE event per time slot per calendar
 */
export async function cleanupGoogleCalendarDuplicates(userId: string): Promise<void> {
  const admin = createAdminClient()

  console.log('Starting aggressive Google Calendar duplicate cleanup...')

  // 1. Fetch only INCLUDED calendars (ones actively synced)
  const { data: calendars, error: calError } = await admin
    .from('calendars')
    .select(
      `id, account_id, provider_calendar_id, name,
       calendar_accounts(access_token, refresh_token)`
    )
    .eq('user_id', userId)
    .eq('is_included', true)

  if (calError) {
    console.error('Failed to fetch calendars:', calError)
    throw calError
  }

  if (!calendars || calendars.length === 0) {
    console.log('No calendars found')
    return
  }

  // Build provider map
  const providerMap = new Map<string, GoogleCalendarProvider>()
  for (const cal of calendars) {
    if (!providerMap.has(cal.account_id)) {
      const accountData = Array.isArray(cal.calendar_accounts)
        ? cal.calendar_accounts[0]
        : cal.calendar_accounts

      const provider = new GoogleCalendarProvider(
        serverEnv.GOOGLE_CLIENT_ID,
        serverEnv.GOOGLE_CLIENT_SECRET,
        serverEnv.GOOGLE_REDIRECT_URI,
        accountData.access_token,
        accountData.refresh_token ?? undefined
      )
      providerMap.set(cal.account_id, provider)
    }
  }

  // 2. For each calendar, find and delete duplicate events by time slot
  let totalDeleted = 0

  for (const cal of calendars) {
    try {
      console.log(`\nProcessing calendar: ${cal.name}`)

      const provider = providerMap.get(cal.account_id)!

      // List all events in a wide range
      const timeMin = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()

      const events = await provider.listEvents(cal.provider_calendar_id, timeMin, timeMax)

      // Filter to "Busy" or managed events (with or without metadata)
      const busyEvents = events.filter(
        (e) =>
          e.summary === 'Busy' ||
          e.extendedProperties?.private?.busyguard === 'managed' ||
          e.description?.includes('Managed by BusyGuard')
      )

      console.log(`Found ${busyEvents.length} "Busy" or managed events`)
      if (busyEvents.length > 0) {
        console.log(`  Sample events:`)
        busyEvents.slice(0, 5).forEach((e, i) => {
          const start = e.start.dateTime || e.start.date
          console.log(
            `    ${i + 1}. "${e.summary || '(No title)'}" at ${start}, sourceId: ${e.extendedProperties?.private?.sourceEventId || 'none'}`
          )
        })
      }

      // Group by sourceEventId if available, otherwise by time slot
      // This catches both tracked and untracked duplicates
      const grouped = new Map<string, typeof busyEvents>()
      for (const event of busyEvents) {
        let key: string

        // Prefer grouping by sourceEventId if available
        const sourceId = event.extendedProperties?.private?.sourceEventId
        if (sourceId) {
          key = `source:${sourceId}`
        } else {
          // Otherwise group by normalized time (ignoring timezone)
          const startTime = event.start.dateTime || event.start.date
          const endTime = event.end.dateTime || event.end.date
          // Normalize by removing timezone info for comparison
          const normalizedStart = startTime?.split('+')[0]?.split('Z')[0] || startTime
          const normalizedEnd = endTime?.split('+')[0]?.split('Z')[0] || endTime
          key = `time:${normalizedStart}|${normalizedEnd}`
        }

        if (!grouped.has(key)) {
          grouped.set(key, [])
        }
        grouped.get(key)!.push(event)
      }

      // Delete "(No title)" events (completely invalid)
      let deletedForThisCalendar = 0
      const noTitleEvents = busyEvents.filter((e) => !e.summary || e.summary === '(No title)')
      console.log(`  ${noTitleEvents.length} "(No title)" events to delete`)
      for (const event of noTitleEvents) {
        try {
          await provider.deleteEvent(cal.provider_calendar_id, event.id)
          console.log(
            `    Deleted "(No title)" event: ${event.start.dateTime || event.start.date}`
          )
          deletedForThisCalendar++
          totalDeleted++
        } catch (error) {
          if ((error as any)?.code === 410) {
            console.log(`    Event already deleted`)
          } else {
            console.error(`    Failed to delete event ${event.id}:`, error)
          }
        }
      }

      // Delete old "Busy" events without sourceEventId (can't track them)
      // Keep only recent ones with proper tracking
      const oldUntrackedEvents = busyEvents.filter(
        (e) =>
          e.summary === 'Busy' &&
          !e.extendedProperties?.private?.sourceEventId &&
          !e.description?.includes('Managed by BusyGuard')
      )
      console.log(`  ${oldUntrackedEvents.length} old untracked "Busy" events to delete`)
      for (const event of oldUntrackedEvents) {
        try {
          await provider.deleteEvent(cal.provider_calendar_id, event.id)
          console.log(
            `    Deleted untracked "Busy" event: ${event.start.dateTime || event.start.date}`
          )
          deletedForThisCalendar++
          totalDeleted++
        } catch (error) {
          if ((error as any)?.code === 410) {
            console.log(`    Event already deleted`)
          } else {
            console.error(`    Failed to delete event ${event.id}:`, error)
          }
        }
      }

      // Delete duplicates (multiple at same time slot)
      for (const [groupKey, dupeEvents] of grouped.entries()) {
        if (dupeEvents.length > 1) {
          console.log(
            `  Found ${dupeEvents.length} duplicate events: ${groupKey}`
          )

          // Keep the first one, delete the rest
          const toDelete = dupeEvents.slice(1)
          for (const event of toDelete) {
            try {
              await provider.deleteEvent(cal.provider_calendar_id, event.id)
              console.log(
                `    Deleted duplicate event: ${event.summary || '(No title)'} ${event.start.dateTime || event.start.date}`
              )
              deletedForThisCalendar++
              totalDeleted++
            } catch (error) {
              if ((error as any)?.code === 410) {
                console.log(`    Event already deleted`)
              } else {
                console.error(`    Failed to delete event ${event.id}:`, error)
              }
            }
          }
        }
      }

      console.log(`Deleted ${deletedForThisCalendar} events from ${cal.name}`)
    } catch (error) {
      console.error(`Error processing calendar ${cal.name}:`, error)
    }
  }

  console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} duplicate events from Google Calendar`)
}
