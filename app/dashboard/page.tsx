import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, CalendarDays, Shield } from 'lucide-react'
import type { Calendar, CalendarAccount } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { SyncStatusCard } from '@/components/dashboard/sync-status-card'
import { AccountListSection } from '@/components/dashboard/account-list-section'
import { CalendarToggleSection } from '@/components/dashboard/calendar-toggle-section'
import { ConnectAccountCard } from '@/components/dashboard/connect-account-card'

export const revalidate = 30

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: accountsData } = await supabase
    .from('calendar_accounts')
    .select('id, provider, email, display_name, created_at, updated_at, user_id, access_token, refresh_token')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const accounts = (accountsData || []) as CalendarAccount[]

  let calendars: Calendar[] = []
  let busyBlockCounts: Record<string, number> = {}

  if (accounts.length > 0) {
    const accountIds = accounts.map((a) => a.id)

    const [calendarsResult, blocksResult] = await Promise.all([
      supabase
        .from('calendars')
        .select('id, account_id, user_id, provider_calendar_id, name, is_included, color, last_sync_at, created_at')
        .in('account_id', accountIds)
        .order('name', { ascending: true }),
      supabase
        .from('managed_busy_blocks')
        .select('target_calendar_id')
        .eq('user_id', user.id),
    ])

    calendars = (calendarsResult.data || []) as Calendar[]

    if (blocksResult.data) {
      for (const row of blocksResult.data) {
        const id = row.target_calendar_id
        busyBlockCounts[id] = (busyBlockCounts[id] || 0) + 1
      }
    }
  }

  const totalBlocks = Object.values(busyBlockCounts).reduce((sum, n) => sum + n, 0)
  const enabledCalendars = calendars.filter((c) => c.is_included).length

  const stats = [
    { label: 'Connected Accounts', value: accounts.length, icon: Users },
    { label: 'Calendars', value: calendars.length, sub: `${enabledCalendars} enabled`, icon: CalendarDays },
    { label: 'Active Busy Blocks', value: totalBlocks, sub: `across ${Object.keys(busyBlockCounts).length} calendars`, icon: Shield },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage your calendar accounts and choose which calendars to sync
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, sub, icon: Icon }) => (
          <Card key={label} className="hover:shadow-sm">
            <CardContent className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-8">
          <AccountListSection accounts={accounts} />
          {calendars.length > 0 && (
            <CalendarToggleSection calendars={calendars} accounts={accounts} />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {calendars.length > 0 && (
            <SyncStatusCard calendars={calendars} busyBlockCounts={busyBlockCounts} />
          )}
          <ConnectAccountCard />
        </div>
      </div>

      {/* Empty State */}
      {accounts.length === 0 && (
        <Card className="text-center">
          <CardContent className="py-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50 text-primary-600 mb-4">
              <CalendarDays className="h-7 w-7" />
            </div>
            <h2 className="font-display text-xl font-bold text-gray-900 mb-2">
              Get started with BusyGuard
            </h2>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Connect your Google or Outlook calendar to sync your events
            </p>
            <a
              href="/dashboard/accounts"
              className="inline-flex items-center px-5 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-xs"
            >
              Connect your first account
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
