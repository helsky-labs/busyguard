export interface CalendarAccount {
  id: string
  user_id: string
  provider: 'google' | 'microsoft'
  email: string
  display_name: string | null
  access_token: string
  refresh_token: string | null
  created_at: string
  updated_at: string
}

export interface Calendar {
  id: string
  account_id: string
  user_id: string
  provider_calendar_id: string
  google_id?: string
  microsoft_id?: string
  name: string
  description: string | null
  is_included: boolean
  color: string | null
  last_sync_at: string | null
  last_sync_time: string | null
  next_sync_time: string | null
  sync_status: 'idle' | 'syncing' | 'error'
  sync_error: string | null
  created_at: string
  updated_at: string
}

export interface SyncStatus {
  calendar_id: string
  is_syncing: boolean
  last_sync: string | null
  next_sync: string | null
  error_message: string | null
}

export interface ExtendedProperties {
  private?: Record<string, string>
  shared?: Record<string, string>
}

export interface CalendarAccountCredentials {
  access_token: string
  refresh_token?: string | null
}

export interface UserSettings {
  user_id: string
  sync_ahead_days: 3 | 7 | 30
  busy_block_title: string
  auto_sync_enabled: boolean
  created_at: string
  updated_at: string
}

export const SYNC_RANGE_OPTIONS = [
  { value: 3, label: '3 days' },
  { value: 7, label: '1 week' },
  { value: 30, label: '1 month' },
] as const

export const DEFAULT_USER_SETTINGS: Pick<UserSettings, 'sync_ahead_days' | 'busy_block_title' | 'auto_sync_enabled'> = {
  sync_ahead_days: 3,
  busy_block_title: 'Busy',
  auto_sync_enabled: true,
}
