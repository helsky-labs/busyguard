'use client'

import type { Calendar } from '@/lib/types'
import { SyncNowButton } from './sync-now-button'

interface SyncStatusCardProps {
  calendars: Calendar[]
  busyBlockCounts: Record<string, number>
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
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
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">
          {enabledCalendars.length === 0 ? '○' : '✓'}
        </span>
        <h2 className="text-lg font-semibold text-gray-900">Sync Status</h2>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600">Active Calendars</p>
          <p className="text-xl font-semibold text-gray-900">
            {enabledCalendars.length}/{calendars.length}
          </p>
        </div>
        <div>
          <p className="text-gray-600">Busy Blocks</p>
          <p className="text-xl font-semibold text-gray-900">{totalBlocks}</p>
        </div>
      </div>

      {/* Per-calendar sync times */}
      {enabledCalendars.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Synced</p>
          {enabledCalendars.map((cal) => (
            <div key={cal.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 truncate flex-1 mr-2">{cal.name}</span>
              <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
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
        <p className="text-xs text-gray-500">
          Last sync: {new Date(mostRecentSync).toLocaleString()}
        </p>
      )}

      {/* Sync Now button */}
      <SyncNowButton />
    </div>
  )
}
