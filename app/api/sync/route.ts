import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncCalendars } from '@/lib/sync-engine'
import { logger } from '@/lib/logger'

/**
 * User-facing sync endpoint — triggers a manual sync for the authenticated user.
 * POST /api/sync
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('Manual sync triggered by user', { userId: user.id })
    const startTime = Date.now()

    await syncCalendars(user.id, 'manual')

    const duration = Date.now() - startTime
    return NextResponse.json({
      success: true,
      durationMs: duration,
    })
  } catch (error) {
    logger.error('User sync failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
