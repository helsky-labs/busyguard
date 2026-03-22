'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Calendar, CalendarAccount } from '@/lib/types'

interface CalendarToggleSectionProps {
  calendars: Calendar[]
  accounts: CalendarAccount[]
}

export function CalendarToggleSection({ calendars, accounts }: CalendarToggleSectionProps) {
  const router = useRouter()
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const calendarsByAccount = calendars.reduce(
    (acc, cal) => {
      const accountId = cal.account_id
      if (!acc[accountId]) {
        acc[accountId] = []
      }
      acc[accountId].push(cal)
      return acc
    },
    {} as Record<string, Calendar[]>
  )

  const handleToggle = async (calendarId: string, currentValue: boolean) => {
    setToggling(calendarId)
    setError(null)

    try {
      const response = await fetch('/api/calendars/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, is_included: !currentValue }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update calendar')
      }

      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle calendar'
      setError(message)
    } finally {
      setToggling(null)
    }
  }

  if (calendars.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-600">No calendars found. Connect an account to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Select Calendars to Sync</h2>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(calendarsByAccount).map(([accountId, accountCalendars]) => {
          const account = accountMap.get(accountId)
          if (!account) return null

          const enabledCount = accountCalendars.filter((c) => c.is_included).length

          return (
            <div
              key={accountId}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-center gap-2 mb-4 pb-4 border-b">
                <span className="text-lg">
                  {account.provider === 'google' ? '🔵' : '⚪'}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    {account.display_name || account.email}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {enabledCount} of {accountCalendars.length} calendars enabled
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {accountCalendars.map((calendar) => (
                  <div
                    key={calendar.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <label htmlFor={`cal-${calendar.id}`} className="flex items-center gap-3 cursor-pointer">
                        <input
                          id={`cal-${calendar.id}`}
                          type="checkbox"
                          checked={calendar.is_included}
                          onChange={() => handleToggle(calendar.id, calendar.is_included)}
                          disabled={toggling === calendar.id}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {calendar.name}
                          </p>
                          {calendar.description && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              {calendar.description}
                            </p>
                          )}
                        </div>
                      </label>
                    </div>

                    <div className="ml-4 flex items-center gap-2">
                      {calendar.sync_status === 'error' && (
                        <span title={calendar.sync_error || 'Sync error'} aria-label="Sync error" role="img" className="text-red-500">
                          ⚠️
                        </span>
                      )}
                      {calendar.sync_status === 'syncing' && (
                        <span aria-label="Syncing" role="img" className="text-yellow-500">⟳</span>
                      )}
                      {calendar.sync_status === 'idle' && calendar.is_included && (
                        <span aria-label="Synced" role="img" className="text-green-500">✓</span>
                      )}
                      {toggling === calendar.id && (
                        <span className="text-gray-500 text-sm">Updating...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
