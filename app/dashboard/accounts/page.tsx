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
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Calendar Accounts</h1>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Calendar Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Google Calendar</h2>
              <p className="text-sm text-gray-600 mt-1">Connect your Google Calendar to sync events</p>
            </div>
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-lg">🔴</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t">
            <a
              href="/api/accounts/google/connect"
              className="w-full inline-block text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Connect Google
            </a>
          </div>
        </div>

        {/* Microsoft Calendar Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Microsoft Outlook</h2>
              <p className="text-sm text-gray-600 mt-1">Connect your Outlook calendar to sync events</p>
            </div>
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-lg">⚪</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t">
            <button
              disabled
              className="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>

      {/* Connected Accounts with Calendars */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Connected Accounts</h2>

        {loading ? (
          <p className="text-gray-600 text-center py-8">Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <p className="text-gray-600 text-center py-8 bg-gray-50 rounded-lg">
            No accounts connected yet. Connect your first calendar above to get started.
          </p>
        ) : (
          <div className="space-y-6">
            {accounts.map((account) => {
              const accountCalendars = getCalendarsForAccount(account.id)
              const enabledCount = accountCalendars.filter((c) => c.is_included).length

              return (
                <div key={account.id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Account header */}
                  <div className="p-4 flex items-center justify-between border-b">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {account.provider === 'google' ? '🔵' : '⚪'}
                        </span>
                        <p className="font-semibold text-gray-900">
                          {account.display_name || account.email}
                        </p>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {account.provider === 'google' ? 'Google' : 'Outlook'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{account.email}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Connected {new Date(account.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDisconnect(account.id)}
                      disabled={disconnecting === account.id}
                      className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {disconnecting === account.id ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>

                  {/* Calendars list */}
                  {accountCalendars.length > 0 && (
                    <div className="p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                        Calendars ({enabledCount}/{accountCalendars.length} syncing)
                      </p>
                      <div className="space-y-2">
                        {accountCalendars.map((cal) => (
                          <div
                            key={cal.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <label htmlFor={`cal-${cal.id}`} className="flex items-center gap-3 cursor-pointer flex-1">
                              <input
                                id={`cal-${cal.id}`}
                                type="checkbox"
                                checked={cal.is_included}
                                onChange={() => handleToggle(cal.id, cal.is_included)}
                                disabled={toggling === cal.id}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span className="text-sm text-gray-900">{cal.name}</span>
                            </label>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {toggling === cal.id && <span>Updating...</span>}
                              {cal.is_included && cal.last_sync_at && (
                                <span>Synced {timeAgo(cal.last_sync_at)}</span>
                              )}
                              {cal.is_included && (
                                <span className="text-green-500">✓</span>
                              )}
                            </div>
                          </div>
                        ))}
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
