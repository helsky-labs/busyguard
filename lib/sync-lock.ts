import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

const LOCK_TTL_MINUTES = 5

/**
 * Attempt to acquire a per-user sync lock.
 * Returns true if lock was acquired, false if another sync is running.
 * Expired locks are automatically reclaimed.
 */
export async function acquireSyncLock(
  userId: string,
  source: 'webhook' | 'manual' | 'initial'
): Promise<boolean> {
  const admin = createAdminClient()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MINUTES * 60 * 1000)

  // Try to insert a new lock
  const { error: insertError } = await admin.from('sync_locks').insert({
    user_id: userId,
    locked_at: now.toISOString(),
    locked_by: source,
    expires_at: expiresAt.toISOString(),
  })

  if (!insertError) {
    logger.info('Sync lock acquired', { userId, source })
    return true
  }

  // Insert failed — row exists. Check if it's expired.
  if (insertError.code === '23505') {
    const { data: existing } = await admin
      .from('sync_locks')
      .select('expires_at')
      .eq('user_id', userId)
      .single()

    if (existing && new Date(existing.expires_at) < now) {
      // Lock expired — reclaim it
      const { error: updateError } = await admin
        .from('sync_locks')
        .update({
          locked_at: now.toISOString(),
          locked_by: source,
          expires_at: expiresAt.toISOString(),
        })
        .eq('user_id', userId)

      if (!updateError) {
        logger.info('Reclaimed expired sync lock', { userId, source })
        return true
      }
    }

    logger.info('Sync lock held by another process', { userId })
    return false
  }

  logger.error('Unexpected error acquiring sync lock', { error: insertError })
  return false
}

/**
 * Release a per-user sync lock.
 */
export async function releaseSyncLock(userId: string): Promise<void> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('sync_locks')
    .delete()
    .eq('user_id', userId)

  if (error) {
    logger.error('Failed to release sync lock', { userId, error })
  }
}
