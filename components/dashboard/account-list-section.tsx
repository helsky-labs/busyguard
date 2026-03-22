'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CalendarAccount } from '@/lib/types'

interface AccountListSectionProps {
  accounts: CalendarAccount[]
  onDisconnect?: (accountId: string) => Promise<void>
}

export function AccountListSection({ accounts, onDisconnect }: AccountListSectionProps) {
  const router = useRouter()
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this account? All associated calendars will be removed.')) {
      return
    }

    setDisconnecting(accountId)
    setError(null)

    try {
      if (onDisconnect) {
        await onDisconnect(accountId)
      } else {
        const response = await fetch('/api/accounts/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId }),
        })

        if (!response.ok) {
          throw new Error('Failed to disconnect account')
        }
      }

      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect account'
      setError(message)
    } finally {
      setDisconnecting(null)
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-600 mb-4">No accounts connected yet.</p>
        <Link
          href="/dashboard/accounts"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Connect your first account
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Connected Accounts</h2>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">
                  {account.provider === 'google' ? '🔵' : '⚪'}
                </span>
                <p className="font-semibold text-gray-900">
                  {account.display_name || account.email}
                </p>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  {account.provider === 'google' ? 'Google' : 'Outlook'}
                </span>
              </div>
              <p className="text-sm text-gray-600">{account.email}</p>
              <p className="text-xs text-gray-500 mt-1">
                Connected {new Date(account.created_at).toLocaleDateString()}
              </p>
            </div>

            <button
              onClick={() => handleDisconnect(account.id)}
              disabled={disconnecting === account.id}
              aria-label={`Disconnect ${account.display_name || account.email}`}
              className="ml-4 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {disconnecting === account.id ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ))}
      </div>

      <div className="pt-2">
        <Link
          href="/dashboard/accounts"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Add another account →
        </Link>
      </div>
    </div>
  )
}
