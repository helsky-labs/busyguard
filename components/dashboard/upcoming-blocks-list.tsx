import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BusyBlockWithContext } from '@/lib/queries/busy-blocks'

interface UpcomingBlocksListProps {
  blocks: BusyBlockWithContext[]
}

function getBlockStatus(block: BusyBlockWithContext): { label: string; variant: 'default' | 'success' | 'warning' } {
  const now = Date.now()
  const start = new Date(block.event_start).getTime()
  const end = new Date(block.event_end).getTime()

  if (end < now) return { label: 'Past', variant: 'default' }
  if (start <= now && now <= end) return { label: 'Active', variant: 'success' }
  return { label: 'Scheduled', variant: 'warning' }
}

function formatBlockTime(dateString: string) {
  const date = new Date(dateString)
  const today = new Date()

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (date.toDateString() === today.toDateString()) return timeStr

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return `${dateStr}, ${timeStr}`
}

export function UpcomingBlocksList({ blocks }: UpcomingBlocksListProps) {
  if (blocks.length === 0) return null

  // Filter out past blocks, show upcoming and active first
  const now = Date.now()
  const relevant = blocks.filter(
    (b) => new Date(b.event_end).getTime() > now - 3600000 // include blocks that ended within last hour
  )

  if (relevant.length === 0) return null

  const displayed = relevant.slice(0, 20)

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-gray-900">Upcoming Busy Blocks</h2>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">
                    Source Event
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">
                    Time
                  </th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">
                    Target Calendar
                  </th>
                  <th className="text-right text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((block) => {
                  const status = getBlockStatus(block)
                  return (
                    <tr key={block.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: block.source_calendar.color || '#9CA3AF' }}
                          />
                          <span className="text-gray-900 truncate max-w-[180px]">
                            {block.source_event_summary || 'Event'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatBlockTime(block.event_start)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: block.target_calendar.color || '#9CA3AF' }}
                          />
                          <span className="text-gray-700 truncate max-w-[150px]">
                            {block.target_calendar.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {relevant.length > 20 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                Showing 20 of {relevant.length} blocks
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
