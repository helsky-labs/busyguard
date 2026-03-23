import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, CalendarDays, Shield } from 'lucide-react'
import type { Calendar, CalendarAccount } from '@/lib/types'
import { DEFAULT_USER_SETTINGS } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { SyncStatusCard } from '@/components/dashboard/sync-status-card'
import { SettingsCard } from '@/components/dashboard/settings-card'
import { AccountListSection } from '@/components/dashboard/account-list-section'
import { CalendarToggleSection } from '@/components/dashboard/calendar-toggle-section'
import { ConnectAccountCard } from '@/components/dashboard/connect-account-card'
import { OnboardingEmptyState } from '@/components/dashboard/onboarding-empty-state'
import { SyncActivityFeed } from '@/components/dashboard/sync-activity-feed'
import { BusyBlockTimeline } from '@/components/dashboard/busy-block-timeline'
import { UpcomingBlocksList } from '@/components/dashboard/upcoming-blocks-list'
import { SyncMap } from '@/components/dashboard/sync-map'
import { getBusyBlocksForUser } from '@/lib/queries/busy-blocks'

export const revalidate = 30

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: accountsData } = await supabase
    .from('calendar_accounts')
    .select('id, provider, email, display_name, created_at, updated_at, user_id, access_token, refresh_token, token_expires_at')
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

  // Fetch user settings and recent activity in parallel
  const [{ data: settingsData }, { data: activityData }] = await Promise.all([
    supabase
      .from('user_settings')
      .select('sync_ahead_days, busy_block_title, auto_sync_enabled')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('sync_activity_log')
      .select('id, sync_id, action, source_calendar_id, target_calendar_id, detail, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const userSettings = settingsData ?? DEFAULT_USER_SETTINGS
  const activities = activityData || []

  // Build calendar lookup map for activity feed
  const calendarMap: Record<string, { name: string; color: string | null }> = {}
  for (const cal of calendars) {
    calendarMap[cal.id] = { name: cal.name, color: cal.color }
  }

  // Fetch busy blocks for timeline and upcoming list
  const syncAheadDays = userSettings.sync_ahead_days
  const busyBlocks = accounts.length > 0
    ? await getBusyBlocksForUser(supabase, user.id, {
        timeMin: new Date(Date.now() - 86400000).toISOString(),
        timeMax: new Date(Date.now() + syncAheadDays * 86400000).toISOString(),
      })
    : []

  // Split into today's blocks (for timeline) and all blocks (for list)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  const todayBlocks = busyBlocks.filter((b) => {
    const start = new Date(b.event_start).getTime()
    return start >= todayStart.getTime() && start < tomorrowStart.getTime()
  })

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
          <Card key={label} className="hover:shadow-sm hover:-translate-y-0.5 transition-transform">
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

      {/* Sync Map */}
      {accounts.length >= 2 && (
        <SyncMap calendars={calendars} accounts={accounts} />
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-8">
          <AccountListSection accounts={accounts} />
          {calendars.length > 0 && (
            <CalendarToggleSection calendars={calendars} accounts={accounts} />
          )}
          {todayBlocks.length > 0 && (
            <BusyBlockTimeline blocks={todayBlocks} busyBlockTitle={userSettings.busy_block_title} />
          )}
          {busyBlocks.length > 0 && (
            <UpcomingBlocksList blocks={busyBlocks} />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {calendars.length > 0 && (
            <SyncStatusCard calendars={calendars} busyBlockCounts={busyBlockCounts} />
          )}
          {activities.length > 0 && (
            <SyncActivityFeed activities={activities} calendarMap={calendarMap} />
          )}
          <SettingsCard settings={userSettings} />
          <ConnectAccountCard />
        </div>
      </div>

      {/* Empty State */}
      {accounts.length === 0 && <OnboardingEmptyState />}
    </div>
  )
}
