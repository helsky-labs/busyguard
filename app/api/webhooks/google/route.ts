import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncCalendars } from '@/lib/sync-engine'

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers()
    const resourceState = headersList.get('x-goog-resource-state')

    // TEMPORARILY DISABLED: Webhook processing is disabled to prevent duplicate event creation
    // TODO: Re-enable after fixing webhook channel validation and sync logic
    console.log('⚠️ Webhook received but processing is disabled (resourceState:', resourceState, ')')

    // Always return 200 to acknowledge receipt and prevent Google retries
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error in Google webhook handler:', error)
    return NextResponse.json({ received: true })
  }
}
