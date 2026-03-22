'use client'

import { CheckCircle2, Circle } from 'lucide-react'
import type { Calendar } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { timeAgo } from '@/lib/utils'
import { SyncNowButton } from './sync-now-button'

interface SyncStatusCardProps {
  calendars: Calendar[]
  busyBlockCounts: Record<string, number>
}

export function SyncStatusCard({ calendars, busyBlockCounts }: SyncStatusCardProps) {
  const enabledCalendars = calendars.filter((c) => c.is_included)
  const totalBlocks = Object.values(busyBlockCounts).reduce((sum, n) => sum + n, 0)

  const mostRecentSync = enabledCalendars
    .map((c) => c.last_sync_at)
    .filter((t): t is string => !!t)
    .sort()
    .reverse()[0]

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-2.5">
          {enabledCalendars.length === 0 ? (
            <Circle className="h-5 w-5 text-gray-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          <h2 className="font-display font-semibold text-gray-900">Sync Status</h2>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Active Calendars</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {enabledCalendars.length}/{calendars.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Busy Blocks</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{totalBlocks}</p>
          </div>
        </div>

        {/* Per-calendar sync times */}
        {enabledCalendars.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Synced</p>
            {enabledCalendars.map((cal) => (
              <div key={cal.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate flex-1 mr-2">{cal.name}</span>
                <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                  {busyBlockCounts[cal.id] ? (
                    <span>{busyBlockCounts[cal.id]} blocks</span>
                  ) : null}
                  <span>{cal.last_sync_at ? timeAgo(cal.last_sync_at) : 'never'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Last overall sync */}
        {mostRecentSync && (
          <p className="text-xs text-gray-400">
            Last sync: {new Date(mostRecentSync).toLocaleString()}
          </p>
        )}

        <SyncNowButton />
      </CardContent>
    </Card>
  )
}
