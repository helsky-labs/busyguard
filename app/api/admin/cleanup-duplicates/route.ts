import { NextRequest, NextResponse } from 'next/server'
import { cleanupDuplicates } from '@/lib/cleanup-duplicates'
import { logger } from '@/lib/logger'
import { validateAdminAuth } from '@/lib/auth/admin-guard'

/**
 * Admin endpoint to cleanup duplicate managed blocks from both Google Calendar and database
 * POST /api/admin/cleanup-duplicates?userId=<user_id>
 */
export async function POST(request: NextRequest) {
  const auth = validateAdminAuth(request)
  if (!auth.valid) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      )
    }

    logger.info('Starting cleanup', { userId })
    await cleanupDuplicates(userId)

    return NextResponse.json({
      success: true,
      message: `Cleanup completed for user ${userId}`,
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
