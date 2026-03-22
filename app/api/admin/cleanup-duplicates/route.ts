import { NextRequest, NextResponse } from 'next/server'
import { cleanupDuplicates } from '@/lib/cleanup-duplicates'

/**
 * Admin endpoint to cleanup duplicate managed blocks from both Google Calendar and database
 * POST /api/admin/cleanup-duplicates?userId=<user_id>
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
    // For now, this is admin-only and should be protected by environment/API key

    console.log(`Starting cleanup for user ${userId}`)
    await cleanupDuplicates(userId)

    return NextResponse.json({
      success: true,
      message: `Cleanup completed for user ${userId}`,
    })
  } catch (error) {
    console.error('Cleanup failed:', error)
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
