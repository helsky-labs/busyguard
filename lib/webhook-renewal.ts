import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleCalendarProvider } from '@/lib/providers/google'

interface WebhookChannel {
  id: string
  calendar_id: string
  channel_id: string
  resource_id: string
  expiry: string
  calendars: any // Supabase nested select returns array or object
}

interface CalendarWithAccount {
  id: string
  account_id: string
  provider_calendar_id: string
  calendar_accounts: {
    access_token: string
    refresh_token?: string | null
  }
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
    console.error('Failed to fetch expiring webhook channels:', fetchError)
    throw fetchError
  }

  if (!expiringChannels || expiringChannels.length === 0) {
    console.log('No webhook channels expiring within 24 hours')
    return { checked: 0, renewed: 0, failed: 0 }
  }

  console.log(`Found ${expiringChannels.length} expiring webhook channels`)

  let renewed = 0
  let failed = 0

  for (const channel of expiringChannels) {
    try {
      await renewWebhookChannel(admin, channel as WebhookChannel)
      renewed++
    } catch (error) {
      console.error(`Failed to renew webhook channel ${(channel as any).id}:`, error)
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

  console.log(
    `Renewing webhook channel ${channel.channel_id} for calendar ${calendar.provider_calendar_id}`
  )

  // Build provider from account credentials
  const accountsData = calendar.calendar_accounts as any
  const accountData = Array.isArray(accountsData) ? accountsData[0] : accountsData

  const provider = new GoogleCalendarProvider(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!,
    accountData.access_token,
    accountData.refresh_token ?? undefined
  )

  // Step 1: Stop the old watch (graceful cleanup)
  try {
    await provider.stopWatch(
      calendar.provider_calendar_id,
      channel.channel_id,
      channel.resource_id
    )
    console.log(`Stopped old watch ${channel.channel_id}`)
  } catch (error) {
    // Log but continue - we want to set up new watch even if stop fails
    console.warn(`Failed to stop old watch ${channel.channel_id}:`, error)
  }

  // Step 2: Set up a new watch
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google`
  const webhookToken = process.env.GOOGLE_WEBHOOK_TOKEN!

  const newWatch = await provider.setupWatch(
    calendar.provider_calendar_id,
    webhookToken,
    webhookUrl
  )

  console.log(`Set up new watch with channel_id ${newWatch.id}`)

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
    console.error('Failed to update webhook channel in database:', updateError)
    throw updateError
  }

  console.log(`Updated webhook_channels record ${channel.id}`)
}
