'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, AlertTriangle, RefreshCw } from 'lucide-react'
import type { Calendar, CalendarAccount } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Toggle } from '@/components/ui/toggle'
import { Alert } from '@/components/ui/alert'

interface CalendarToggleSectionProps {
  calendars: Calendar[]
  accounts: CalendarAccount[]
}

const providerColors: Record<string, string> = {
  google: 'bg-blue-500',
  microsoft: 'bg-gray-400',
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
      <Card className="text-center">
        <CardContent className="py-8">
          <p className="text-gray-500">No calendars found. Connect an account to get started.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-gray-900">Select Calendars to Sync</h2>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-4">
        {Object.entries(calendarsByAccount).map(([accountId, accountCalendars]) => {
          const account = accountMap.get(accountId)
          if (!account) return null

          const enabledCount = accountCalendars.filter((c) => c.is_included).length

          return (
            <Card key={accountId}>
              <CardContent>
                <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-gray-100">
                  <span className={`h-2.5 w-2.5 rounded-full ${providerColors[account.provider] || 'bg-gray-400'}`} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">
                      {account.display_name || account.email}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {enabledCount} of {accountCalendars.length} calendars enabled
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {accountCalendars.map((calendar) => (
                    <div
                      key={calendar.id}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors -mx-1"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Toggle
                          id={`cal-${calendar.id}`}
                          checked={calendar.is_included}
                          onChange={() => handleToggle(calendar.id, calendar.is_included)}
                          disabled={toggling === calendar.id}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {calendar.name}
                          </p>
                          {calendar.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {calendar.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="ml-3 flex items-center gap-2 shrink-0">
                        {calendar.sync_status === 'error' && (
                          <AlertTriangle
                            className="h-4 w-4 text-amber-500"
                            aria-label="Sync error"
                          />
                        )}
                        {calendar.sync_status === 'syncing' && (
                          <RefreshCw
                            className="h-4 w-4 text-primary-500 animate-spin"
                            aria-label="Syncing"
                          />
                        )}
                        {calendar.sync_status === 'idle' && calendar.is_included && (
                          <Check
                            className="h-4 w-4 text-green-500"
                            aria-label="Synced"
                          />
                        )}
                        {toggling === calendar.id && (
                          <span className="text-gray-400 text-xs">Updating...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
