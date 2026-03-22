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
