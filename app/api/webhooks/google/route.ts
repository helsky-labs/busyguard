import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncCalendars } from '@/lib/sync-engine'

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const channelToken = headersList.get('x-goog-channel-token')
    const resourceState = headersList.get('x-goog-resource-state')
    const channelId = headersList.get('x-goog-channel-id')

    // Validate webhook token
    if (channelToken !== process.env.GOOGLE_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Handle sync notifications (initial ping when watch is registered)
    if (resourceState === 'sync') {
      console.log('Received Google calendar sync notification')
      return NextResponse.json({ received: true })
    }

    // Handle calendar change notifications
    if (resourceState === 'exists' && channelId) {
      console.log('Calendar event changed, triggering sync for channel:', channelId)

      // Find the user associated with this channel
      const admin = createAdminClient()
      const { data: channel, error: channelError } = await admin
        .from('webhook_channels')
        .select(
          `channel_id, calendar_id,
           calendars(user_id)`
        )
        .eq('channel_id', channelId)
        .maybeSingle()

      if (channelError) {
        console.error('Error fetching webhook channel:', channelError)
        return NextResponse.json(
          { error: 'Failed to find channel' },
          { status: 404 }
        )
      }

      if (!channel || !channel.calendars) {
        console.log('Channel not found:', channelId)
        return NextResponse.json(
          { error: 'Channel not found' },
          { status: 404 }
        )
      }

      const userId = (channel.calendars as any).user_id

      // Trigger sync for this user
      try {
        await syncCalendars(userId)
      } catch (syncError) {
        console.error('Error during sync:', syncError)
        // Return 200 anyway - Google doesn't retry on 5xx
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error in Google webhook handler:', error)
    // Return 200 to acknowledge receipt (prevent Google retry)
    return NextResponse.json({ received: true })
  }
}
