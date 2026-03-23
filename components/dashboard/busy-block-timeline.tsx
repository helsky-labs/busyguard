import { ArrowDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { BusyBlockWithContext } from '@/lib/queries/busy-blocks'

interface BusyBlockTimelineProps {
  blocks: BusyBlockWithContext[]
  busyBlockTitle: string
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDateHeading(dateString: string) {
  const date = new Date(dateString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function groupByDate(blocks: BusyBlockWithContext[]) {
  const groups: { date: string; blocks: BusyBlockWithContext[] }[] = []
  const map = new Map<string, BusyBlockWithContext[]>()

  for (const block of blocks) {
    const dateKey = new Date(block.event_start).toDateString()
    const existing = map.get(dateKey)
    if (existing) {
      existing.push(block)
    } else {
      const arr = [block]
      map.set(dateKey, arr)
      groups.push({ date: block.event_start, blocks: arr })
    }
  }

  return groups
}

export function BusyBlockTimeline({ blocks, busyBlockTitle }: BusyBlockTimelineProps) {
  if (blocks.length === 0) return null

  const groups = groupByDate(blocks)

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-gray-900">Busy Block Timeline</h2>

      {groups.map((group) => (
        <Card key={group.date}>
          <CardContent className="space-y-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {formatDateHeading(group.date)}
            </p>

            <div className="space-y-4">
              {group.blocks.map((block) => (
                <div key={block.id} className="relative pl-4 border-l-2 border-gray-100">
                  {/* Time range */}
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    {formatTime(block.event_start)} – {formatTime(block.event_end)}
                  </p>

                  {/* Source event */}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: block.source_calendar.color || '#9CA3AF' }}
                    />
                    <span className="text-sm text-gray-900 truncate">
                      {block.source_event_summary || 'Event'}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      ({block.source_calendar.name})
                    </span>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center gap-2 ml-0.5 my-1">
                    <ArrowDown className="h-3 w-3 text-gray-300" />
                  </div>

                  {/* Target busy block */}
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: block.target_calendar.color || '#9CA3AF' }}
                    />
                    <span className="text-sm text-gray-600 truncate">
                      {busyBlockTitle}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      → {block.target_calendar.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
