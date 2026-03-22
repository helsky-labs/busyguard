import { NextRequest, NextResponse } from 'next/server'
import { nuclearCleanup } from '@/lib/cleanup-google-calendar'

/**
 * Admin endpoint for NUCLEAR cleanup - deletes ALL "Busy" and "(No title)" events
 * POST /api/admin/nuclear-cleanup?userId=<user_id>
 *
 * WARNING: This is destructive. Next sync will recreate events cleanly from scratch.
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

    console.log(`🔴 NUCLEAR CLEANUP INITIATED for user ${userId}`)
    const startTime = Date.now()

    await nuclearCleanup(userId)

    const duration = Date.now() - startTime
    return NextResponse.json({
      success: true,
      message: `Nuclear cleanup completed for user ${userId}. Next sync will recreate events cleanly.`,
      durationMs: duration,
    })
  } catch (error) {
    console.error('Nuclear cleanup failed:', error)
    return NextResponse.json(
      {
        error: 'Nuclear cleanup failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
