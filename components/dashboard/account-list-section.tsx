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
      <div className="card !p-10 text-center">
        <p className="text-body text-content-secondary mb-5">No accounts connected yet.</p>
        <Link href="/dashboard/accounts" className="btn-accent">
          Connect your first account
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-heading-3">Connected Accounts</h2>

      {error && (
        <div className="p-4 rounded-xl text-body-sm font-medium bg-danger-subtle text-danger">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="card-interactive !p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-accent-subtle flex items-center justify-center shrink-0">
                <span className="text-body-sm font-semibold text-accent">
                  {account.provider === 'google' ? 'G' : 'M'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-body-sm truncate">
                    {account.display_name || account.email}
                  </p>
                  <span className="badge-neutral shrink-0">
                    {account.provider === 'google' ? 'Google' : 'Outlook'}
                  </span>
                </div>
                <p className="text-caption text-content-tertiary truncate">
                  {account.email} &middot; Connected {new Date(account.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleDisconnect(account.id)}
              disabled={disconnecting === account.id}
              aria-label={`Disconnect ${account.display_name || account.email}`}
              className="btn-danger shrink-0 ml-4"
            >
              {disconnecting === account.id ? 'Removing...' : 'Disconnect'}
            </button>
          </div>
        ))}
      </div>

      <div className="pt-1">
        <Link
          href="/dashboard/accounts"
          className="text-body-sm text-accent font-medium hover:underline underline-offset-4"
        >
          Add another account &rarr;
        </Link>
      </div>
    </div>
  )
}
