import { NextRequest, NextResponse } from 'next/server'
import { checkAndRenewChannels } from '@/lib/webhook-renewal'

/**
 * Scheduled endpoint to renew expiring webhook channels.
 *
 * Can be called:
 * 1. By Vercel Cron (via vercel.json cron config)
 * 2. By external cron service with authorization header
 * 3. Manually for testing/debugging
 *
 * Requires CRON_SECRET environment variable for authorization.
 */
export async function GET(request: NextRequest) {
  try {
    // Validate authorization
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    // Allow requests from:
    // 1. Vercel Cron (no auth header, special Vercel header)
    // 2. Authorized external requests (Bearer token)
    const isVercelCron = request.headers.get('x-vercel-cron') === process.env.CRON_SECRET
    const isAuthorized = authHeader === expectedAuth

    if (!isVercelCron && !isAuthorized) {
      console.warn('Unauthorized webhook renewal request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting webhook channel renewal check')

    const result = await checkAndRenewChannels()

    console.log('Webhook renewal completed:', result)

    return NextResponse.json({
      success: true,
      message: 'Webhook channel renewal completed',
      ...result,
    })
  } catch (error) {
    console.error('Error in webhook renewal endpoint:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to renew webhook channels',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
