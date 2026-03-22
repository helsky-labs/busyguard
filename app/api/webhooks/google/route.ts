import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncCalendars } from '@/lib/sync-engine'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const resourceState = headersList.get('x-goog-resource-state')

    // TEMPORARILY DISABLED: Webhook processing is disabled to prevent duplicate event creation
    // TODO: Re-enable after fixing webhook channel validation and sync logic
    logger.info('Webhook received but processing is disabled', { resourceState })

    // Always return 200 to acknowledge receipt and prevent Google retries
    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Error in Google webhook handler', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ received: true })
  }
}
