import { createAdminClient } from '@/lib/supabase/admin'
import { createGoogleProvider, type GoogleCalendarProvider } from '@/lib/providers/google'
import { logger } from '@/lib/logger'

/**
 * NUCLEAR OPTION: Delete ALL "Busy" and "(No title)" events from included calendars
 * Starts fresh - next sync will recreate events cleanly
 */
export async function nuclearCleanup(userId: string): Promise<void> {
  const admin = createAdminClient()

  logger.info('NUCLEAR CLEANUP: Deleting ALL "Busy" and "(No title)" events')

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
    logger.error('Failed to fetch calendars', { error: calError instanceof Error ? calError.message : String(calError) })
    throw calError
  }

  if (!calendars || calendars.length === 0) {
    logger.info('No calendars found')
    return
  }

  // Build provider map
  const providerMap = new Map<string, GoogleCalendarProvider>()
  for (const cal of calendars) {
    if (!providerMap.has(cal.account_id)) {
      const accountData = Array.isArray(cal.calendar_accounts)
        ? cal.calendar_accounts[0]
        : cal.calendar_accounts

      const provider = createGoogleProvider(
        accountData.access_token,
        accountData.refresh_token
      )
      providerMap.set(cal.account_id, provider)
    }
  }

  // 2. Delete ALL "Busy" and "(No title)" events
  let totalDeleted = 0

  for (const cal of calendars) {
    try {
      logger.info('Processing calendar', { calendarName: cal.name })

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

      logger.info('Found events to delete', { count: toDelete.length })

      for (const event of toDelete) {
        try {
          await provider.deleteEvent(cal.provider_calendar_id, event.id)
          logger.info('Deleted event', { summary: event.summary || '(No title)', start: event.start.dateTime || event.start.date })
          totalDeleted++
        } catch (error) {
          if ((error as any)?.code === 410) {
            logger.info('Event already deleted')
          } else {
            logger.error('Failed to delete event', { eventId: event.id, error: error instanceof Error ? error.message : String(error) })
          }
        }
      }

      logger.info('Deleted events from calendar', { count: toDelete.length, calendarName: cal.name })
    } catch (error) {
      logger.error('Error processing calendar', { calendarName: cal.name, error: error instanceof Error ? error.message : String(error) })
    }
  }

  logger.info('NUCLEAR CLEANUP COMPLETE', { deletedEvents: totalDeleted })
  logger.info('Next sync will recreate all events cleanly')
}

/**
 * Aggressively clean up ALL duplicate "Busy" events from Google Calendar
 * Groups by time slot and keeps only ONE event per time slot per calendar
 */
export async function cleanupGoogleCalendarDuplicates(userId: string): Promise<void> {
  const admin = createAdminClient()

  logger.info('Starting aggressive Google Calendar duplicate cleanup')

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
    logger.error('Failed to fetch calendars', { error: calError instanceof Error ? calError.message : String(calError) })
    throw calError
  }

  if (!calendars || calendars.length === 0) {
    logger.info('No calendars found')
    return
  }

  // Build provider map
  const providerMap = new Map<string, GoogleCalendarProvider>()
  for (const cal of calendars) {
    if (!providerMap.has(cal.account_id)) {
      const accountData = Array.isArray(cal.calendar_accounts)
        ? cal.calendar_accounts[0]
        : cal.calendar_accounts

      const provider = createGoogleProvider(
        accountData.access_token,
        accountData.refresh_token
      )
      providerMap.set(cal.account_id, provider)
    }
  }

  // 2. For each calendar, find and delete duplicate events by time slot
  let totalDeleted = 0

  for (const cal of calendars) {
    try {
      logger.info('Processing calendar', { calendarName: cal.name })

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

      logger.info('Found busy or managed events', { count: busyEvents.length })
      if (busyEvents.length > 0) {
        const sampleEvents = busyEvents.slice(0, 5).map((e, i) => ({
          index: i + 1,
          summary: e.summary || '(No title)',
          start: e.start.dateTime || e.start.date,
          sourceId: e.extendedProperties?.private?.sourceEventId || 'none',
        }))
        logger.info('Sample events', { sampleEvents })
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
      logger.info('No title events to delete', { count: noTitleEvents.length })
      for (const event of noTitleEvents) {
        try {
          await provider.deleteEvent(cal.provider_calendar_id, event.id)
          logger.info('Deleted (No title) event', { start: event.start.dateTime || event.start.date })
          deletedForThisCalendar++
          totalDeleted++
        } catch (error) {
          if ((error as any)?.code === 410) {
            logger.info('Event already deleted')
          } else {
            logger.error('Failed to delete event', { eventId: event.id, error: error instanceof Error ? error.message : String(error) })
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
      logger.info('Old untracked Busy events to delete', { count: oldUntrackedEvents.length })
      for (const event of oldUntrackedEvents) {
        try {
          await provider.deleteEvent(cal.provider_calendar_id, event.id)
          logger.info('Deleted untracked Busy event', { start: event.start.dateTime || event.start.date })
          deletedForThisCalendar++
          totalDeleted++
        } catch (error) {
          if ((error as any)?.code === 410) {
            logger.info('Event already deleted')
          } else {
            logger.error('Failed to delete event', { eventId: event.id, error: error instanceof Error ? error.message : String(error) })
          }
        }
      }

      // Delete duplicates (multiple at same time slot)
      for (const [groupKey, dupeEvents] of grouped.entries()) {
        if (dupeEvents.length > 1) {
          logger.info('Found duplicate events', { count: dupeEvents.length, groupKey })

          // Keep the first one, delete the rest
          const toDelete = dupeEvents.slice(1)
          for (const event of toDelete) {
            try {
              await provider.deleteEvent(cal.provider_calendar_id, event.id)
              logger.info('Deleted duplicate event', { summary: event.summary || '(No title)', start: event.start.dateTime || event.start.date })
              deletedForThisCalendar++
              totalDeleted++
            } catch (error) {
              if ((error as any)?.code === 410) {
                logger.info('Event already deleted')
              } else {
                logger.error('Failed to delete event', { eventId: event.id, error: error instanceof Error ? error.message : String(error) })
              }
            }
          }
        }
      }

      logger.info('Deleted events from calendar', { count: deletedForThisCalendar, calendarName: cal.name })
    } catch (error) {
      logger.error('Error processing calendar', { calendarName: cal.name, error: error instanceof Error ? error.message : String(error) })
    }
  }

  logger.info('Cleanup complete', { deletedEvents: totalDeleted })
}
