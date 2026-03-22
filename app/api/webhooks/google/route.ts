import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncCalendars } from '@/lib/sync-engine'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

const DEBOUNCE_SECONDS = 30

export async function POST(request: NextRequest) {
  try {
    // 1. Validate webhook token
    const token = request.headers.get('x-goog-channel-token')
    if (token !== serverEnv.GOOGLE_WEBHOOK_TOKEN) {
      logger.warn('Invalid webhook token')
      return NextResponse.json({ received: true })
    }

    const channelId = request.headers.get('x-goog-channel-id')
    const resourceState = request.headers.get('x-goog-resource-state')

    // Ignore sync notifications (sent when watch is first created)
    if (resourceState === 'sync') {
      logger.info('Webhook sync notification, ignoring', { channelId })
      return NextResponse.json({ received: true })
    }

    if (!channelId) {
      logger.warn('Webhook missing channel ID')
      return NextResponse.json({ received: true })
    }

    // 2. Look up channel → calendar → user
    const admin = createAdminClient()
    const { data: channel } = await admin
      .from('webhook_channels')
      .select('calendar_id, calendars(user_id, last_sync_at)')
      .eq('channel_id', channelId)
      .single()

    if (!channel) {
      logger.warn('Unknown webhook channel', { channelId })
      return NextResponse.json({ received: true })
    }

    const calendarData = Array.isArray(channel.calendars)
      ? channel.calendars[0]
      : channel.calendars
    const userId = (calendarData as { user_id: string; last_sync_at: string | null }).user_id
    const lastSyncAt = (calendarData as { user_id: string; last_sync_at: string | null }).last_sync_at

    // 3. Debounce: skip if last sync was within threshold
    if (lastSyncAt) {
      const elapsed = (Date.now() - new Date(lastSyncAt).getTime()) / 1000
      if (elapsed < DEBOUNCE_SECONDS) {
        logger.info('Webhook debounced', { userId, elapsed: Math.round(elapsed) })
        return NextResponse.json({ received: true })
      }
    }

    // 4. Trigger sync (sync lock inside syncCalendars prevents concurrency)
    logger.info('Webhook triggering sync', { userId, channelId })
    await syncCalendars(userId, 'webhook')

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Error in Google webhook handler', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Always return 200 to prevent Google retries
    return NextResponse.json({ received: true })
  }
}
