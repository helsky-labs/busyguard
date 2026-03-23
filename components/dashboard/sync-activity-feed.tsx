import { Plus, RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { timeAgo } from '@/lib/utils'

interface ActivityEntry {
  id: string
  sync_id: string
  action: 'created' | 'updated' | 'deleted' | 'error' | 'skipped'
  source_calendar_id: string | null
  target_calendar_id: string | null
  detail: string | null
  created_at: string
}

interface CalendarLookup {
  name: string
  color: string | null
}

interface SyncActivityFeedProps {
  activities: ActivityEntry[]
  calendarMap: Record<string, CalendarLookup>
}

const actionConfig = {
  created: { icon: Plus, label: 'Created', color: 'text-green-600' },
  updated: { icon: RefreshCw, label: 'Updated', color: 'text-blue-600' },
  deleted: { icon: Trash2, label: 'Deleted', color: 'text-gray-500' },
  error: { icon: AlertTriangle, label: 'Error', color: 'text-red-600' },
  skipped: { icon: RefreshCw, label: 'Skipped', color: 'text-gray-400' },
} as const

function groupBySyncId(activities: ActivityEntry[]) {
  const groups: { syncId: string; timestamp: string; entries: ActivityEntry[] }[] = []
  const map = new Map<string, ActivityEntry[]>()

  for (const a of activities) {
    const existing = map.get(a.sync_id)
    if (existing) {
      existing.push(a)
    } else {
      const arr = [a]
      map.set(a.sync_id, arr)
      groups.push({ syncId: a.sync_id, timestamp: a.created_at, entries: arr })
    }
  }

  return groups
}

function summarizeGroup(entries: ActivityEntry[]) {
  const counts: Record<string, number> = {}
  for (const e of entries) {
    counts[e.action] = (counts[e.action] || 0) + 1
  }
  const parts: string[] = []
  if (counts.created) parts.push(`${counts.created} created`)
  if (counts.updated) parts.push(`${counts.updated} updated`)
  if (counts.deleted) parts.push(`${counts.deleted} deleted`)
  if (counts.error) parts.push(`${counts.error} error${counts.error > 1 ? 's' : ''}`)
  return parts.join(', ') || 'No changes'
}

export function SyncActivityFeed({ activities, calendarMap }: SyncActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardContent>
          <h2 className="font-display font-semibold text-gray-900 mb-3">Recent Activity</h2>
          <p className="text-sm text-gray-400">No sync activity yet</p>
        </CardContent>
      </Card>
    )
  }

  const groups = groupBySyncId(activities)

  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-display font-semibold text-gray-900">Recent Activity</h2>

        <div className="space-y-3">
          {groups.slice(0, 5).map((group) => (
            <div key={group.syncId} className="border-l-2 border-gray-100 pl-3">
              <p className="text-xs text-gray-400 mb-1">
                Sync {timeAgo(group.timestamp)}
              </p>
              <p className="text-sm text-gray-700">{summarizeGroup(group.entries)}</p>

              {group.entries.some((e) => e.action === 'error') && (
                <div className="mt-1 space-y-0.5">
                  {group.entries
                    .filter((e) => e.action === 'error')
                    .map((e) => {
                      const config = actionConfig[e.action]
                      const Icon = config.icon
                      return (
                        <div key={e.id} className="flex items-center gap-1.5 text-xs text-red-600">
                          <Icon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{e.detail || 'Unknown error'}</span>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
