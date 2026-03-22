'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SyncNowButton() {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)

    try {
      const response = await fetch('/api/sync', { method: 'POST' })
      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, message: `Synced in ${data.durationMs}ms` })
        router.refresh()
      } else {
        setResult({ success: false, message: data.error || 'Sync failed' })
      }
    } catch {
      setResult({ success: false, message: 'Network error' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
      {result && (
        <p className={`text-xs mt-2 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.message}
        </p>
      )}
    </div>
  )
}
