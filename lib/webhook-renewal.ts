import { createAdminClient } from '@/lib/supabase/admin'
import { createGoogleProvider } from '@/lib/providers/google'
import { serverEnv, publicEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

import type { CalendarAccountCredentials } from '@/lib/types'

interface CalendarWithAccount {
  id: string
  account_id: string
  provider_calendar_id: string
  calendar_accounts: CalendarAccountCredentials | CalendarAccountCredentials[]
}

interface WebhookChannel {
  id: string
  calendar_id: string
  channel_id: string
  resource_id: string
  expiry: string
  calendars: CalendarWithAccount | CalendarWithAccount[]
}

/**
 * Check for expiring webhook channels and renew them before they expire.
 * Finds all channels expiring within 24 hours and:
 * 1. Stops the old watch (graceful cleanup)
 * 2. Sets up a new watch (fresh subscription)
 * 3. Updates database with new channel info
 *
 * Runs as admin to access all webhook channels across users.
 */
export async function checkAndRenewChannels(): Promise<{
  checked: number
  renewed: number
  failed: number
}> {
  const admin = createAdminClient()

  // Find channels expiring within 24 hours
  const expiryThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: expiringChannels, error: fetchError } = await admin
    .from('webhook_channels')
    .select(
      `id, calendar_id, channel_id, resource_id, expiry,
       calendars(id, provider_calendar_id, account_id, calendar_accounts(access_token, refresh_token))`
    )
    .lt('expiry', expiryThreshold)
    .eq('provider', 'google') // Only Google for now

  if (fetchError) {
    logger.error('Failed to fetch expiring webhook channels', { error: fetchError instanceof Error ? fetchError.message : String(fetchError) })
    throw fetchError
  }

  if (!expiringChannels || expiringChannels.length === 0) {
    logger.info('No webhook channels expiring within 24 hours')
    return { checked: 0, renewed: 0, failed: 0 }
  }

  logger.info('Found expiring webhook channels', { count: expiringChannels.length })

  let renewed = 0
  let failed = 0

  for (const channel of expiringChannels) {
    try {
      await renewWebhookChannel(admin, channel as WebhookChannel)
      renewed++
    } catch (error) {
      logger.error('Failed to renew webhook channel', { channelId: (channel as any).id, error: error instanceof Error ? error.message : String(error) })
      failed++
    }
  }

  return {
    checked: expiringChannels.length,
    renewed,
    failed,
  }
}

/**
 * Renew a single webhook channel
 */
async function renewWebhookChannel(
  admin: ReturnType<typeof createAdminClient>,
  channel: WebhookChannel
): Promise<void> {
  // Supabase nested select returns array or object depending on cardinality
  const calendarsData = Array.isArray(channel.calendars)
    ? channel.calendars[0]
    : channel.calendars
  const calendar = calendarsData as CalendarWithAccount

  logger.info('Renewing webhook channel', { channelId: channel.channel_id, calendarId: calendar.provider_calendar_id })

  // Build provider from account credentials
  const accountData = Array.isArray(calendar.calendar_accounts)
    ? calendar.calendar_accounts[0]
    : calendar.calendar_accounts

  const provider = createGoogleProvider(
    accountData.access_token,
    accountData.refresh_token
  )

  // Step 1: Stop the old watch (graceful cleanup)
  try {
    await provider.stopWatch(
      calendar.provider_calendar_id,
      channel.channel_id,
      channel.resource_id
    )
    logger.info('Stopped old watch', { channelId: channel.channel_id })
  } catch (error) {
    // Log but continue - we want to set up new watch even if stop fails
    logger.warn('Failed to stop old watch', { channelId: channel.channel_id, error: error instanceof Error ? error.message : String(error) })
  }

  // Step 2: Set up a new watch
  const webhookUrl = `${publicEnv.APP_URL}/api/webhooks/google`
  const webhookToken = serverEnv.GOOGLE_WEBHOOK_TOKEN

  const newWatch = await provider.setupWatch(
    calendar.provider_calendar_id,
    webhookToken,
    webhookUrl
  )

  logger.info('Set up new watch', { channelId: newWatch.id })

  // Step 3: Update database with new channel info
  const { error: updateError } = await admin
    .from('webhook_channels')
    .update({
      channel_id: newWatch.id,
      resource_id: newWatch.resourceId,
      expiry: new Date(parseInt(newWatch.expiration)).toISOString(),
    })
    .eq('id', channel.id)

  if (updateError) {
    logger.error('Failed to update webhook channel in database', { error: updateError instanceof Error ? updateError.message : String(updateError) })
    throw updateError
  }

  logger.info('Updated webhook_channels record', { recordId: channel.id })
}
