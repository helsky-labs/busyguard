'use client'

import { useEffect, useState } from 'react'
import type { Calendar } from '@/lib/types'

interface SyncStatusCardProps {
  calendars: Calendar[]
}

export function SyncStatusCard({ calendars }: SyncStatusCardProps) {
  const totalCalendars = calendars.length
  const enabledCalendars = calendars.filter((c) => c.is_included).length
  const syncingCalendars = calendars.filter((c) => c.sync_status === 'syncing').length
  const errorCalendars = calendars.filter((c) => c.sync_status === 'error').length
  const lastSyncTime = calendars
    .map((c) => c.last_sync_time)
    .filter((t) => t)
    .sort()
    .reverse()[0]

  const getStatusColor = () => {
    if (errorCalendars > 0) return 'bg-red-50 border-red-200'
    if (syncingCalendars > 0) return 'bg-yellow-50 border-yellow-200'
    return 'bg-green-50 border-green-200'
  }

  const getStatusText = () => {
    if (errorCalendars > 0) return 'Some calendars have sync errors'
    if (syncingCalendars > 0) return 'Syncing calendars...'
    if (enabledCalendars === 0) return 'No calendars enabled'
    return 'All calendars syncing normally'
  }

  const getStatusIcon = () => {
    if (errorCalendars > 0) return '⚠️'
    if (syncingCalendars > 0) return '⟳'
    if (enabledCalendars === 0) return '○'
    return '✓'
  }

  return (
    <div className={`rounded-lg border p-6 ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">{getStatusIcon()}</span>
            <h2 className="text-lg font-semibold text-gray-900">Sync Status</h2>
          </div>
          <p className="text-sm text-gray-700 mb-4">{getStatusText()}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Enabled</p>
              <p className="text-xl font-semibold text-gray-900">
                {enabledCalendars}/{totalCalendars}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Issues</p>
              <p className={`text-xl font-semibold ${errorCalendars > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {errorCalendars}
              </p>
            </div>
          </div>
          {lastSyncTime && (
            <p className="text-xs text-gray-600 mt-4">
              Last sync: {new Date(lastSyncTime).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
