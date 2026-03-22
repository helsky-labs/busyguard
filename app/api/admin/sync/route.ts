import { NextRequest, NextResponse } from 'next/server'
import { syncCalendars } from '@/lib/sync-engine'
import { logger } from '@/lib/logger'

/**
 * Admin endpoint to manually trigger calendar sync
 * POST /api/admin/sync?userId=<user_id>
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      )
    }

    // TODO: Add authentication check here
    logger.info('Starting sync', { userId })
    const startTime = Date.now()

    await syncCalendars(userId)

    const duration = Date.now() - startTime
    return NextResponse.json({
      success: true,
      message: `Sync completed for user ${userId}`,
      durationMs: duration,
    })
  } catch (error) {
    logger.error('Sync failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      {
        error: 'Sync failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
