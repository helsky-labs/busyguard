'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

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
    <div className="space-y-2">
      <Button
        onClick={handleSync}
        loading={syncing}
        className="w-full"
      >
        <RefreshCw className="h-4 w-4" />
        {syncing ? 'Syncing...' : 'Sync Now'}
      </Button>
      {result && (
        <Alert variant={result.success ? 'success' : 'error'}>
          {result.message}
        </Alert>
      )}
    </div>
  )
}
