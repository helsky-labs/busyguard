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
      <div className="card !p-10 text-center">
        <p className="text-body text-content-secondary">No calendars found. Connect an account to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-heading-3">Select Calendars to Sync</h2>

      {error && (
        <div className="p-4 rounded-xl text-body-sm font-medium bg-danger-subtle text-danger">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(calendarsByAccount).map(([accountId, accountCalendars]) => {
          const account = accountMap.get(accountId)
          if (!account) return null

          const enabledCount = accountCalendars.filter((c) => c.is_included).length

          return (
            <div key={accountId} className="card">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                <div className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0">
                  <span className="text-caption font-semibold text-accent">
                    {account.provider === 'google' ? 'G' : 'M'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-body-sm truncate">
                    {account.display_name || account.email}
                  </p>
                  <p className="text-caption text-content-tertiary">
                    {enabledCount} of {accountCalendars.length} calendars enabled
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                {accountCalendars.map((calendar) => (
                  <div
                    key={calendar.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-secondary transition-colors"
                  >
                    <label htmlFor={`cal-${calendar.id}`} className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                      <input
                        id={`cal-${calendar.id}`}
                        type="checkbox"
                        checked={calendar.is_included}
                        onChange={() => handleToggle(calendar.id, calendar.is_included)}
                        disabled={toggling === calendar.id}
                        className="w-4 h-4 rounded border-gray-300 text-accent accent-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="min-w-0">
                        <p className="text-body-sm truncate">
                          {calendar.name}
                        </p>
                        {calendar.description && (
                          <p className="text-caption text-content-tertiary truncate">
                            {calendar.description}
                          </p>
                        )}
                      </div>
                    </label>

                    <div className="ml-3 flex items-center gap-2 shrink-0">
                      {calendar.sync_status === 'error' && (
                        <span title={calendar.sync_error || 'Sync error'} aria-label="Sync error" role="img" className="text-danger text-body-sm">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 5v3.5M8 11h.005" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                          </svg>
                        </span>
                      )}
                      {calendar.sync_status === 'syncing' && (
                        <span className="badge-accent">Syncing</span>
                      )}
                      {calendar.sync_status === 'idle' && calendar.is_included && (
                        <span className="text-success">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 7l2.5 2.5L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      )}
                      {toggling === calendar.id && (
                        <span className="text-caption text-content-tertiary">Updating...</span>
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
