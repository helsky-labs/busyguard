'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { Alert } from '@/components/ui/alert'
import { SYNC_RANGE_OPTIONS, type UserSettings } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SettingsCardProps {
  settings: Pick<UserSettings, 'sync_ahead_days' | 'busy_block_title' | 'auto_sync_enabled'>
}

export function SettingsCard({ settings: initial }: SettingsCardProps) {
  const router = useRouter()
  const [syncAheadDays, setSyncAheadDays] = useState(initial.sync_ahead_days)
  const [busyBlockTitle, setBusyBlockTitle] = useState(initial.busy_block_title)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(initial.auto_sync_enabled)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    setResult(null)

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (response.ok) {
        setResult({ success: true, message: 'Saved' })
        router.refresh()
        setTimeout(() => setResult(null), 2000)
      } else {
        const data = await response.json()
        setResult({ success: false, message: data.error || 'Failed to save' })
      }
    } catch {
      setResult({ success: false, message: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-2.5">
          <Settings className="h-5 w-5 text-gray-400" />
          <h2 className="font-display font-semibold text-gray-900">Settings</h2>
        </div>

        {/* Sync Range */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Sync Range</p>
          <div className="grid grid-cols-3 gap-1.5">
            {SYNC_RANGE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                disabled={saving}
                onClick={() => {
                  setSyncAheadDays(value)
                  save({ sync_ahead_days: value })
                }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
                  value === syncAheadDays
                    ? 'bg-primary-50 border-primary-300 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">How far ahead to sync events</p>
        </div>

        {/* Busy Block Title */}
        <div className="space-y-2">
          <Input
            id="busy-block-title"
            label="Busy Block Title"
            value={busyBlockTitle}
            maxLength={50}
            disabled={saving}
            onChange={(e) => setBusyBlockTitle(e.target.value)}
            onBlur={() => {
              const trimmed = busyBlockTitle.trim()
              if (trimmed && trimmed !== initial.busy_block_title) {
                setBusyBlockTitle(trimmed)
                save({ busy_block_title: trimmed })
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur()
              }
            }}
          />
          <p className="text-xs text-gray-400">Shown on created busy blocks</p>
        </div>

        {/* Auto-Sync Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-700">Auto-sync</p>
            <p className="text-xs text-gray-400">Sync when calendar changes are detected</p>
          </div>
          <Toggle
            checked={autoSyncEnabled}
            disabled={saving}
            onChange={(checked) => {
              setAutoSyncEnabled(checked)
              save({ auto_sync_enabled: checked })
            }}
          />
        </div>

        {result && (
          <Alert variant={result.success ? 'success' : 'error'}>
            {result.message}
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
