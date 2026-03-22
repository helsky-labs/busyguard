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
        className="btn-accent w-full"
      >
        {syncing ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
              <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Syncing...
          </span>
        ) : 'Sync Now'}
      </button>
      {result && (
        <p className={`text-caption mt-2 text-center ${result.success ? 'text-success' : 'text-danger'}`}>
          {result.message}
        </p>
      )}
    </div>
  )
}
