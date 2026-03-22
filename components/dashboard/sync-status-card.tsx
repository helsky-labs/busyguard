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
    <div className="card space-y-5">
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${enabledCalendars.length > 0 ? 'bg-success' : 'bg-content-tertiary'}`} />
        <h2 className="text-heading-3">Sync Status</h2>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="section-label">Active</p>
          <p className="text-xl font-bold tracking-tight mt-1">
            {enabledCalendars.length}/{calendars.length}
          </p>
        </div>
        <div>
          <p className="section-label">Blocks</p>
          <p className="text-xl font-bold tracking-tight mt-1">{totalBlocks}</p>
        </div>
      </div>

      {/* Per-calendar sync times */}
      {enabledCalendars.length > 0 && (
        <div className="space-y-2 pt-4 border-t">
          <p className="section-label">Last Synced</p>
          {enabledCalendars.map((cal) => (
            <div key={cal.id} className="flex items-center justify-between py-1">
              <span className="text-body-sm truncate flex-1 mr-3">{cal.name}</span>
              <div className="flex items-center gap-2 text-caption text-content-tertiary shrink-0">
                {busyBlockCounts[cal.id] ? (
                  <span className="badge-neutral">{busyBlockCounts[cal.id]} blocks</span>
                ) : null}
                <span>{cal.last_sync_at ? timeAgo(cal.last_sync_at) : 'never'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Last overall sync */}
      {mostRecentSync && (
        <p className="text-caption text-content-tertiary">
          Last sync: {new Date(mostRecentSync).toLocaleString()}
        </p>
      )}

      {/* Sync Now button */}
      <SyncNowButton />
    </div>
  )
}
