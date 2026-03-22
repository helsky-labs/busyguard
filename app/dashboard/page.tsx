import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Calendar, CalendarAccount } from '@/lib/types'
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

  // Fetch accounts
  const { data: accountsData } = await supabase
    .from('calendar_accounts')
    .select('id, provider, email, display_name, created_at, updated_at, user_id, access_token, refresh_token')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const accounts = (accountsData || []) as CalendarAccount[]

  // Fetch calendars and busy block counts
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

    // Count blocks per target calendar
    if (blocksResult.data) {
      for (const row of blocksResult.data) {
        const id = row.target_calendar_id
        busyBlockCounts[id] = (busyBlockCounts[id] || 0) + 1
      }
    }
  }

  const totalBlocks = Object.values(busyBlockCounts).reduce((sum, n) => sum + n, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage your calendar accounts and choose which calendars to sync
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Connected Accounts</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{accounts.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Calendars</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{calendars.length}</p>
          <p className="text-xs text-gray-500 mt-1">
            {calendars.filter((c) => c.is_included).length} enabled
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Active Busy Blocks</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalBlocks}</p>
          <p className="text-xs text-gray-500 mt-1">
            across {Object.keys(busyBlockCounts).length} calendars
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Accounts and Calendar selection */}
        <div className="lg:col-span-2 space-y-8">
          <AccountListSection accounts={accounts} />
          {calendars.length > 0 && (
            <CalendarToggleSection calendars={calendars} accounts={accounts} />
          )}
        </div>

        {/* Right column: Status and actions */}
        <div className="space-y-6">
          {calendars.length > 0 && (
            <SyncStatusCard calendars={calendars} busyBlockCounts={busyBlockCounts} />
          )}
          <ConnectAccountCard />
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">How it works</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Connect your calendar accounts</li>
              <li>• Select which calendars to sync</li>
              <li>• We'll continuously sync your events</li>
              <li>• Toggle calendars anytime</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-3xl mb-4">📅</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Get started with BusyGuard
          </h2>
          <p className="text-gray-600 mb-6">
            Connect your Google or Outlook calendar to sync your events
          </p>
          <a
            href="/dashboard/accounts"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Connect your first account
          </a>
        </div>
      )}
    </div>
  )
}
