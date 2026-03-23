import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_USER_SETTINGS } from '@/lib/types'

const ALLOWED_FIELDS = ['sync_ahead_days', 'busy_block_title', 'auto_sync_enabled'] as const
const VALID_SYNC_DAYS = [3, 7, 30]

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Validate sync_ahead_days
  if ('sync_ahead_days' in updates && !VALID_SYNC_DAYS.includes(updates.sync_ahead_days as number)) {
    return NextResponse.json({ error: 'sync_ahead_days must be 3, 7, or 30' }, { status: 400 })
  }

  // Validate busy_block_title
  if ('busy_block_title' in updates) {
    const title = updates.busy_block_title
    if (typeof title !== 'string' || title.length < 1 || title.length > 50) {
      return NextResponse.json({ error: 'busy_block_title must be 1-50 characters' }, { status: 400 })
    }
  }

  // Validate auto_sync_enabled
  if ('auto_sync_enabled' in updates && typeof updates.auto_sync_enabled !== 'boolean') {
    return NextResponse.json({ error: 'auto_sync_enabled must be a boolean' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, ...DEFAULT_USER_SETTINGS, ...updates },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  return NextResponse.json(data)
}
