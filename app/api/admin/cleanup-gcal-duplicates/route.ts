import { NextRequest, NextResponse } from 'next/server'
import { cleanupGoogleCalendarDuplicates } from '@/lib/cleanup-google-calendar'
import { logger } from '@/lib/logger'

/**
 * Admin endpoint to cleanup duplicate managed "Busy" events from Google Calendar
 * POST /api/admin/cleanup-gcal-duplicates?userId=<user_id>
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

    logger.info('Starting Google Calendar cleanup', { userId })
    const startTime = Date.now()

    await cleanupGoogleCalendarDuplicates(userId)

    const duration = Date.now() - startTime
    return NextResponse.json({
      success: true,
      message: `Google Calendar cleanup completed for user ${userId}`,
      durationMs: duration,
    })
  } catch (error) {
    logger.error('Cleanup failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
