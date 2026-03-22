import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

/**
 * Cron endpoint to clean up stale managed_busy_blocks rows.
 *
 * Rows are kept after orphan cleanup to prevent sync loops during Google's
 * eventual consistency window. After 30 days, those rows are safe to delete —
 * the events are long gone from Google's listing.
 *
 * GET /api/scheduled/cleanup-stale-blocks
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${serverEnv.CRON_SECRET}`
    const isVercelCron = request.headers.get('x-vercel-cron') === serverEnv.CRON_SECRET
    const isAuthorized = authHeader === expectedAuth

    if (!isVercelCron && !isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: staleRows, error: countError } = await admin
      .from('managed_busy_blocks')
      .select('id', { count: 'exact' })
      .lt('event_end', cutoff)

    if (countError) {
      logger.error('Failed to count stale blocks', { error: countError.message })
      throw countError
    }

    const staleCount = staleRows?.length ?? 0

    if (staleCount === 0) {
      logger.info('No stale managed_busy_blocks to clean up')
      return NextResponse.json({ success: true, deleted: 0 })
    }

    const { error: deleteError } = await admin
      .from('managed_busy_blocks')
      .delete()
      .lt('event_end', cutoff)

    if (deleteError) {
      logger.error('Failed to delete stale blocks', { error: deleteError.message })
      throw deleteError
    }

    logger.info('Cleaned up stale managed_busy_blocks', { deleted: staleCount, cutoff })

    return NextResponse.json({
      success: true,
      deleted: staleCount,
      cutoff,
    })
  } catch (error) {
    logger.error('Stale block cleanup failed', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
