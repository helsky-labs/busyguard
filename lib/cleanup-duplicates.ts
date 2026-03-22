import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarProvider, createGoogleProvider } from '@/lib/providers/google'
import { logger } from '@/lib/logger'

interface DuplicateBlock {
  source_event_id: string
  target_calendar_id: string
  blocks: Array<{
    id: string
    busy_event_id: string
    account_id: string
    provider_calendar_id: string
  }>
}

/**
 * Find and delete duplicate managed blocks from both Google Calendar and database
 * Keeps the most recent block for each source_event_id/target_calendar_id pair
 */
export async function cleanupDuplicates(userId: string): Promise<void> {
  const admin = createAdminClient()

  logger.info('Starting duplicate cleanup')

  // 1. Find all calendars with account info (needed for provider)
  const { data: calendars, error: calError } = await admin
    .from('calendars')
    .select(
      `id, account_id, provider_calendar_id,
       calendar_accounts(access_token, refresh_token)`
    )
    .eq('user_id', userId)

  if (calError) {
    logger.error('Failed to fetch calendars', { error: calError instanceof Error ? calError.message : String(calError) })
    throw calError
  }

  // Build provider map
  const providerMap = new Map<string, GoogleCalendarProvider>()
  const calendarMap = new Map<
    string,
    { account_id: string; provider_calendar_id: string }
  >()

  for (const cal of calendars || []) {
    const accountData = Array.isArray(cal.calendar_accounts)
      ? cal.calendar_accounts[0]
      : cal.calendar_accounts

    if (!providerMap.has(cal.account_id)) {
      const provider = createGoogleProvider(
        accountData.access_token,
        accountData.refresh_token
      )
      providerMap.set(cal.account_id, provider)
    }

    calendarMap.set(cal.id, {
      account_id: cal.account_id,
      provider_calendar_id: cal.provider_calendar_id,
    })
  }

  // 2. Find all duplicate blocks (group by source_event_id + target_calendar_id)
  const { data: allBlocks, error: blocksError } = await admin
    .from('managed_busy_blocks')
    .select(
      `id, source_event_id, target_calendar_id, busy_event_id, created_at`
    )
    .eq('user_id', userId)

  if (blocksError) {
    logger.error('Failed to fetch blocks', { error: blocksError instanceof Error ? blocksError.message : String(blocksError) })
    throw blocksError
  }

  // Group by source + target
  const grouped = new Map<string, typeof allBlocks>()
  for (const block of allBlocks || []) {
    const key = `${block.source_event_id}:${block.target_calendar_id}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(block)
  }

  // 3. Find duplicates (more than 1 per group) and delete them
  const duplicates: DuplicateBlock[] = []
  let totalToDelete = 0

  for (const [key, blocks] of grouped.entries()) {
    if (blocks.length > 1) {
      // Sort by created_at descending (most recent first)
      const sorted = [...blocks].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      // Keep the first one, mark the rest for deletion
      const toDelete = sorted.slice(1)
      totalToDelete += toDelete.length

      const [sourceEventId, targetCalendarId] = key.split(':')
      duplicates.push({
        source_event_id: sourceEventId,
        target_calendar_id: targetCalendarId,
        blocks: toDelete.map((block) => ({
          id: block.id,
          busy_event_id: block.busy_event_id,
          account_id: calendarMap.get(targetCalendarId)?.account_id || '',
          provider_calendar_id:
            calendarMap.get(targetCalendarId)?.provider_calendar_id || '',
        })),
      })
    }
  }

  logger.info('Found duplicate sets', { duplicateSets: duplicates.length, blocksToDelete: totalToDelete })

  // 4. Delete from Google Calendar first
  for (const dup of duplicates) {
    for (const block of dup.blocks) {
      try {
        const provider = providerMap.get(block.account_id)
        if (!provider) {
          logger.warn('No provider for account', { accountId: block.account_id })
          continue
        }

        await provider.deleteEvent(block.provider_calendar_id, block.busy_event_id)
        logger.info('Deleted event from Google Calendar', { busyEventId: block.busy_event_id })
      } catch (error) {
        logger.error('Failed to delete event from Google Calendar', { busyEventId: block.busy_event_id, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  // 5. Delete from database
  for (const dup of duplicates) {
    for (const block of dup.blocks) {
      try {
        await admin.from('managed_busy_blocks').delete().eq('id', block.id)
        logger.info('Deleted DB record', { blockId: block.id })
      } catch (error) {
        logger.error('Failed to delete DB record', { blockId: block.id, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  logger.info('Cleanup complete', { deletedBlocks: totalToDelete })
}
