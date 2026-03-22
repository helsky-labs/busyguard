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
    <div className="max-w-5xl space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-heading-1">Dashboard</h1>
        <p className="text-body-sm text-content-secondary mt-1">
          Manage your calendar accounts and sync preferences
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="section-label">Connected Accounts</p>
          <p className="text-3xl font-bold tracking-tight mt-2">{accounts.length}</p>
        </div>
        <div className="card">
          <p className="section-label">Calendars</p>
          <p className="text-3xl font-bold tracking-tight mt-2">{calendars.length}</p>
          <p className="text-caption text-content-tertiary mt-1">
            {calendars.filter((c) => c.is_included).length} enabled
          </p>
        </div>
        <div className="card">
          <p className="section-label">Active Busy Blocks</p>
          <p className="text-3xl font-bold tracking-tight mt-2">{totalBlocks}</p>
          <p className="text-caption text-content-tertiary mt-1">
            across {Object.keys(busyBlockCounts).length} calendars
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
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

          {/* How it works */}
          <div className="card !bg-accent-subtle !border-transparent">
            <p className="text-body-sm font-semibold text-accent mb-3">How it works</p>
            <ul className="space-y-2">
              {[
                'Connect your calendar accounts',
                'Select which calendars to sync',
                'We continuously sync your events',
                'Toggle calendars anytime',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-body-sm text-accent/80">
                  <span className="text-caption font-semibold text-accent/50 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {accounts.length === 0 && (
        <div className="card !p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent">
              <rect x="3" y="5" width="22" height="20" rx="3"/>
              <path d="M3 11h22M9 3v4M19 3v4"/>
            </svg>
          </div>
          <h2 className="text-heading-2 mb-2">
            Get started with BusyGuard
          </h2>
          <p className="text-body text-content-secondary mb-8 max-w-sm mx-auto">
            Connect your Google or Outlook calendar to start syncing your events automatically
          </p>
          <a href="/dashboard/accounts" className="btn-accent !px-8 !py-3">
            Connect your first account
          </a>
        </div>
      )}
    </div>
  )
}
