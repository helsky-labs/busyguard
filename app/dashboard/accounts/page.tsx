'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Toggle } from '@/components/ui/toggle'
import { Alert } from '@/components/ui/alert'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'

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

const providerColors: Record<string, string> = {
  google: 'bg-blue-500',
  microsoft: 'bg-gray-400',
}

export default function AccountsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [accounts, setAccounts] = useState<CalendarAccount[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

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
    setConfirmId(null)
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
      }
    } catch (error) {
      console.error('Disconnect error:', error)
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
      }
    } catch (error) {
      console.error('Toggle error:', error)
    } finally {
      setToggling(null)
    }
  }

  const getCalendarsForAccount = (accountId: string) =>
    calendars.filter((c) => c.account_id === accountId)

  const confirmAccount = accounts.find((a) => a.id === confirmId)

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Calendar Accounts</h1>
        <p className="text-gray-500 mt-1 text-sm">Connect and manage your calendar providers</p>
      </div>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      {/* Provider cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-sm transition-shadow">
          <CardContent>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display font-semibold text-gray-900">Google Calendar</h2>
                <p className="text-sm text-gray-500 mt-1">Connect your Google Calendar to sync events</p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>
            </div>
            <a
              href="/api/accounts/google/connect"
              className="block w-full text-center py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              Connect Google
            </a>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardContent>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display font-semibold text-gray-900">Microsoft Outlook</h2>
                <p className="text-sm text-gray-500 mt-1">Connect your Outlook calendar to sync events</p>
              </div>
              <Badge variant="default">Coming Soon</Badge>
            </div>
            <Button variant="secondary" disabled className="w-full">
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Connected accounts */}
      <div>
        <h2 className="font-display text-xl font-bold text-gray-900 mb-4">Connected Accounts</h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <Card className="text-center">
            <CardContent className="py-8">
              <p className="text-gray-500">
                No accounts connected yet. Connect your first calendar above to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => {
              const accountCalendars = getCalendarsForAccount(account.id)
              const enabledCount = accountCalendars.filter((c) => c.is_included).length

              return (
                <Card key={account.id}>
                  {/* Account header */}
                  <div className="px-4 sm:px-6 py-4 flex items-start sm:items-center justify-between gap-3 border-b border-gray-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${providerColors[account.provider] || 'bg-gray-400'}`} />
                        <p className="font-medium text-gray-900 truncate">
                          {account.display_name || account.email}
                        </p>
                        <Badge variant="default">
                          {account.provider === 'google' ? 'Google' : 'Outlook'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 ml-5 mt-0.5 truncate">{account.email}</p>
                      <p className="text-xs text-gray-400 ml-5 mt-0.5">
                        Connected {new Date(account.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmId(account.id)}
                      loading={disconnecting === account.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                    >
                      {disconnecting === account.id ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </div>

                  {/* Calendars list */}
                  {accountCalendars.length > 0 && (
                    <CardContent>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                        Calendars ({enabledCount}/{accountCalendars.length} syncing)
                      </p>
                      <div className="space-y-1">
                        {accountCalendars.map((cal) => (
                          <div
                            key={cal.id}
                            className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors -mx-1"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Toggle
                                id={`cal-${cal.id}`}
                                checked={cal.is_included}
                                onChange={() => handleToggle(cal.id, cal.is_included)}
                                disabled={toggling === cal.id}
                              />
                              <span className="text-sm text-gray-900 truncate">{cal.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0 ml-3">
                              {toggling === cal.id && <span>Updating...</span>}
                              {cal.is_included && cal.last_sync_at && (
                                <span>Synced {timeAgo(cal.last_sync_at)}</span>
                              )}
                              {cal.is_included && (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Disconnect account?"
        description={confirmAccount ? `This will remove "${confirmAccount.display_name || confirmAccount.email}" and all its synced calendars and busy blocks.` : undefined}
      >
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setConfirmId(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={() => confirmId && handleDisconnect(confirmId)}>
            Disconnect
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
