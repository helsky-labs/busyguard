'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CalendarAccount {
  id: string
  provider: 'google' | 'microsoft'
  email: string
  display_name: string
  created_at: string
}

interface Calendar {
  id: string
  account_id: string
  name: string
  is_included: boolean
  last_sync_at: string | null
}

export default function AccountsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [accounts, setAccounts] = useState<CalendarAccount[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const successMessage = searchParams.get('connected')
    ? `Successfully connected ${searchParams.get('connected')} account!`
    : null

  const fetchData = async () => {
    const supabase = createClient()

    const [accountsRes, calendarsRes] = await Promise.all([
      supabase
        .from('calendar_accounts')
        .select('id, provider, email, display_name, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('calendars')
        .select('id, account_id, name, is_included, last_sync_at')
        .order('name', { ascending: true }),
    ])

    setAccounts(accountsRes.data || [])
    setCalendars(calendarsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this account? All calendars and synced events will be removed.')) return

    setDisconnecting(accountId)
    try {
      const response = await fetch('/api/accounts/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })

      if (response.ok) {
        setAccounts(accounts.filter((a) => a.id !== accountId))
        setCalendars(calendars.filter((c) => c.account_id !== accountId))
      } else {
        alert('Failed to disconnect account')
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      alert('Failed to disconnect account')
    } finally {
      setDisconnecting(null)
    }
  }

  const handleToggle = async (calendarId: string, currentValue: boolean) => {
    setToggling(calendarId)
    try {
      const response = await fetch('/api/calendars/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, is_included: !currentValue }),
      })

      if (response.ok) {
        setCalendars(calendars.map((c) =>
          c.id === calendarId ? { ...c, is_included: !currentValue } : c
        ))
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to toggle calendar')
      }
    } catch (error) {
      console.error('Toggle error:', error)
      alert('Failed to toggle calendar')
    } finally {
      setToggling(null)
    }
  }

  const getCalendarsForAccount = (accountId: string) =>
    calendars.filter((c) => c.account_id === accountId)

  return (
    <div className="max-w-4xl animate-fade-in">
      <h1 className="text-heading-1 mb-2">Calendar Accounts</h1>
      <p className="text-body-sm text-content-secondary mb-8">
        Connect and manage your calendar providers
      </p>

      {successMessage && (
        <div className="mb-6 p-4 rounded-xl text-body-sm font-medium bg-success-subtle text-success">
          {successMessage}
        </div>
      )}

      {/* Provider Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Google Calendar Card */}
        <div className="card">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-heading-3">Google Calendar</h2>
              <p className="text-body-sm text-content-secondary mt-1">Sync events from your Google account</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M17.64 10.2c0-.637-.057-1.251-.164-1.84H10v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M10 19c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H1.957v2.332A8.997 8.997 0 0010 19z" fill="#34A853"/>
                <path d="M4.964 11.71A5.41 5.41 0 014.682 10c0-.593.102-1.17.282-1.71V5.958H1.957A8.997 8.997 0 001 10c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M10 4.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C14.463 1.891 12.426 1 10 1A8.997 8.997 0 001.957 5.958L4.964 8.29C5.672 6.163 7.656 4.58 10 4.58z" fill="#EA4335"/>
              </svg>
            </div>
          </div>
          <a
            href="/api/accounts/google/connect"
            className="btn-accent w-full"
          >
            Connect Google
          </a>
        </div>

        {/* Microsoft Calendar Card */}
        <div className="card">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-heading-3">Microsoft Outlook</h2>
              <p className="text-body-sm text-content-secondary mt-1">Sync events from your Outlook account</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="1" y="1" width="18" height="18" rx="2" fill="#0078D4" opacity="0.15"/>
                <path d="M10 5l7 4v6l-7 4-7-4V9l7-4z" fill="#0078D4" opacity="0.3"/>
              </svg>
            </div>
          </div>
          <button
            disabled
            className="btn-secondary w-full !opacity-40 !cursor-not-allowed"
          >
            Coming Soon
          </button>
        </div>
      </div>

      {/* Connected Accounts with Calendars */}
      <div className="mt-12">
        <h2 className="text-heading-2 mb-6">Connected Accounts</h2>

        {loading ? (
          <div className="card !p-12 text-center">
            <p className="text-body-sm text-content-secondary">Loading accounts...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="card !p-12 text-center">
            <p className="text-body text-content-secondary">
              No accounts connected yet. Connect your first calendar above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => {
              const accountCalendars = getCalendarsForAccount(account.id)
              const enabledCount = accountCalendars.filter((c) => c.is_included).length

              return (
                <div key={account.id} className="card !p-0 overflow-hidden">
                  {/* Account header */}
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-accent-subtle flex items-center justify-center shrink-0">
                        <span className="text-body-sm font-semibold text-accent">
                          {account.provider === 'google' ? 'G' : 'M'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-body truncate">
                            {account.display_name || account.email}
                          </p>
                          <span className="badge-neutral shrink-0">
                            {account.provider === 'google' ? 'Google' : 'Outlook'}
                          </span>
                        </div>
                        <p className="text-body-sm text-content-secondary truncate">{account.email}</p>
                        <p className="text-caption text-content-tertiary mt-0.5">
                          Connected {new Date(account.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnect(account.id)}
                      disabled={disconnecting === account.id}
                      className="btn-danger shrink-0 ml-4"
                    >
                      {disconnecting === account.id ? 'Removing...' : 'Disconnect'}
                    </button>
                  </div>

                  {/* Calendars list */}
                  {accountCalendars.length > 0 && (
                    <div className="px-5 pb-5 pt-0">
                      <div className="border-t pt-4">
                        <p className="section-label mb-3">
                          Calendars ({enabledCount}/{accountCalendars.length} syncing)
                        </p>
                        <div className="space-y-1">
                          {accountCalendars.map((cal) => (
                            <div
                              key={cal.id}
                              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-secondary transition-colors"
                            >
                              <label htmlFor={`cal-${cal.id}`} className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                <input
                                  id={`cal-${cal.id}`}
                                  type="checkbox"
                                  checked={cal.is_included}
                                  onChange={() => handleToggle(cal.id, cal.is_included)}
                                  disabled={toggling === cal.id}
                                  className="w-4 h-4 rounded border-gray-300 text-accent cursor-pointer accent-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span className="text-body-sm truncate">{cal.name}</span>
                              </label>
                              <div className="flex items-center gap-2 text-caption text-content-tertiary shrink-0 ml-3">
                                {toggling === cal.id && <span className="text-content-secondary">Updating...</span>}
                                {cal.is_included && cal.last_sync_at && (
                                  <span>Synced {timeAgo(cal.last_sync_at)}</span>
                                )}
                                {cal.is_included && (
                                  <span className="text-success">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                      <path d="M3 7l2.5 2.5L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
