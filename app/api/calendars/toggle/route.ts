import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createGoogleProvider } from '@/lib/providers/google'
import { serverEnv, publicEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

export async function PATCH(request: NextRequest) {
  const contentType = request.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json' },
      { status: 415 }
    )
  }

  try {
    const { calendarId, is_included } = await request.json()

    if (!calendarId || typeof is_included !== 'boolean') {
      return NextResponse.json(
        { error: 'Calendar ID and is_included status are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch calendar with account credentials (need admin for full access)
    const admin = createAdminClient()
    const { data: calendar, error: fetchError } = await admin
      .from('calendars')
      .select('id, account_id, user_id, provider_calendar_id, calendar_accounts(access_token, refresh_token)')
      .eq('id', calendarId)
      .single()

    if (fetchError || !calendar) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
    }

    if (calendar.user_id !== user.id) {
      return NextResponse.json({ error: 'Calendar not found or unauthorized' }, { status: 404 })
    }

    // Update is_included
    const { error: updateError } = await admin
      .from('calendars')
      .update({ is_included })
      .eq('id', calendarId)

    if (updateError) {
      logger.error('Failed to update calendar', { error: updateError.message })
      return NextResponse.json({ error: 'Failed to update calendar' }, { status: 500 })
    }

    // Webhook + block management
    const accountData = Array.isArray(calendar.calendar_accounts)
      ? calendar.calendar_accounts[0]
      : calendar.calendar_accounts

    if (is_included) {
      // Toggling ON — register webhook channel
      await registerWebhook(admin, calendar, accountData)
    } else {
      // Toggling OFF — stop webhook + cleanup blocks
      await stopWebhookAndCleanup(admin, calendarId, calendar, accountData)
    }

    return NextResponse.json({ success: true, is_included })
  } catch (error) {
    logger.error('Error in toggle calendar', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to update calendar' }, { status: 500 })
  }
}

async function registerWebhook(
  admin: ReturnType<typeof createAdminClient>,
  calendar: { id: string; provider_calendar_id: string; account_id: string },
  accountData: { access_token: string; refresh_token?: string | null }
) {
  try {
    const provider = createGoogleProvider(accountData.access_token, accountData.refresh_token)
    const webhookUrl = `${publicEnv.APP_URL}/api/webhooks/google`
    const webhookToken = serverEnv.GOOGLE_WEBHOOK_TOKEN

    const watch = await provider.setupWatch(
      calendar.provider_calendar_id,
      webhookToken,
      webhookUrl
    )

    await admin.from('webhook_channels').insert({
      calendar_id: calendar.id,
      provider: 'google',
      channel_id: watch.id,
      resource_id: watch.resourceId,
      expiry: new Date(parseInt(watch.expiration)).toISOString(),
    })

    logger.info('Registered webhook for calendar', {
      calendarId: calendar.id,
      channelId: watch.id,
    })
  } catch (error) {
    // Log but don't fail the toggle — the cron will pick up missing webhooks
    logger.error('Failed to register webhook', {
      calendarId: calendar.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function stopWebhookAndCleanup(
  admin: ReturnType<typeof createAdminClient>,
  calendarId: string,
  calendar: { id: string; provider_calendar_id: string; account_id: string },
  accountData: { access_token: string; refresh_token?: string | null }
) {
  // Stop webhook channels
  const { data: channels } = await admin
    .from('webhook_channels')
    .select('id, channel_id, resource_id')
    .eq('calendar_id', calendarId)

  if (channels && channels.length > 0) {
    const provider = createGoogleProvider(accountData.access_token, accountData.refresh_token)

    for (const channel of channels) {
      try {
        await provider.stopWatch(
          calendar.provider_calendar_id,
          channel.channel_id,
          channel.resource_id
        )
      } catch (error) {
        logger.warn('Failed to stop webhook channel', {
          channelId: channel.channel_id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Delete webhook channel records
    await admin
      .from('webhook_channels')
      .delete()
      .eq('calendar_id', calendarId)
  }

  // Delete managed busy blocks where this calendar is the target
  const { error: deleteError } = await admin
    .from('managed_busy_blocks')
    .delete()
    .eq('target_calendar_id', calendarId)

  if (deleteError) {
    logger.error('Failed to cleanup managed blocks', { error: deleteError.message })
  } else {
    logger.info('Cleaned up managed blocks for disabled calendar', { calendarId })
  }
}
