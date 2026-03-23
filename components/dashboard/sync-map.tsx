import { ArrowRight, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Calendar, CalendarAccount } from '@/lib/types'

interface SyncMapProps {
  calendars: Calendar[]
  accounts: CalendarAccount[]
}

interface CalendarRole {
  calendar: Calendar
  isPrimary: boolean
  syncsTo: string[]
  receivesFrom: string[]
}

function buildSyncMap(calendars: Calendar[], accounts: CalendarAccount[]) {
  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const calendarsByAccount = new Map<string, Calendar[]>()

  for (const cal of calendars) {
    if (!cal.is_included) continue
    const existing = calendarsByAccount.get(cal.account_id)
    if (existing) {
      existing.push(cal)
    } else {
      calendarsByAccount.set(cal.account_id, [cal])
    }
  }

  // Identify primary calendars (provider_calendar_id === account email)
  const primaryByAccount = new Map<string, Calendar>()
  for (const [accountId, cals] of calendarsByAccount) {
    const account = accountMap.get(accountId)
    if (!account) continue
    const primary = cals.find((c) => c.provider_calendar_id === account.email)
    if (primary) primaryByAccount.set(accountId, primary)
  }

  // Build role map for each account
  const result: { account: CalendarAccount; roles: CalendarRole[] }[] = []

  for (const [accountId, cals] of calendarsByAccount) {
    const account = accountMap.get(accountId)
    if (!account) continue

    const otherAccountNames = Array.from(primaryByAccount.entries())
      .filter(([id]) => id !== accountId)
      .map(([id]) => accountMap.get(id)?.display_name || accountMap.get(id)?.email || 'Other')

    const roles: CalendarRole[] = cals.map((cal) => {
      const isPrimary = primaryByAccount.get(accountId)?.id === cal.id

      return {
        calendar: cal,
        isPrimary,
        syncsTo: isPrimary ? [] : otherAccountNames,
        receivesFrom: isPrimary ? Array.from(calendarsByAccount.entries())
          .filter(([id]) => id !== accountId)
          .flatMap(([id, otherCals]) => {
            const otherAccount = accountMap.get(id)
            return otherCals
              .filter((c) => c.provider_calendar_id !== otherAccount?.email)
              .map((c) => c.name)
          }) : [],
      }
    })

    result.push({ account, roles })
  }

  return result
}

export function SyncMap({ calendars, accounts }: SyncMapProps) {
  const includedCalendars = calendars.filter((c) => c.is_included)
  if (includedCalendars.length === 0 || accounts.length < 2) return null

  const map = buildSyncMap(calendars, accounts)

  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-display font-semibold text-gray-900">Sync Map</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {map.map(({ account, roles }) => (
            <div key={account.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {account.display_name || account.email}
              </p>

              <div className="space-y-1.5">
                {roles.map(({ calendar, isPrimary, syncsTo, receivesFrom }) => (
                  <div key={calendar.id} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: calendar.color || '#9CA3AF' }}
                    />
                    <span className="text-gray-700 truncate flex-1">{calendar.name}</span>

                    {syncsTo.length > 0 && (
                      <span className="flex items-center gap-1 text-gray-400 shrink-0">
                        <ArrowRight className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">{syncsTo[0]}</span>
                      </span>
                    )}

                    {isPrimary && receivesFrom.length > 0 && (
                      <span className="flex items-center gap-1 text-gray-400 shrink-0">
                        <ArrowLeft className="h-3 w-3" />
                        <span>receives</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
