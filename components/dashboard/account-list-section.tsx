'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { CalendarAccount } from '@/lib/types'
import { getTokenHealth } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Dialog, DialogFooter } from '@/components/ui/dialog'

interface AccountListSectionProps {
  accounts: CalendarAccount[]
  onDisconnect?: (accountId: string) => Promise<void>
}

const healthColors: Record<string, string> = {
  healthy: 'bg-green-500',
  warning: 'bg-amber-500',
  broken: 'bg-red-500',
}

const healthLabels: Record<string, string> = {
  healthy: 'Connected',
  warning: 'Token expiring',
  broken: 'Re-authentication needed',
}

export function AccountListSection({ accounts, onDisconnect }: AccountListSectionProps) {
  const router = useRouter()
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleDisconnect = async (accountId: string) => {
    setConfirmId(null)
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

  const confirmAccount = accounts.find((a) => a.id === confirmId)

  if (accounts.length === 0) {
    return (
      <Card className="text-center">
        <CardContent className="py-8">
          <p className="text-gray-500 mb-4">No accounts connected yet.</p>
          <Link
            href="/dashboard/accounts"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Connect your first account
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display font-semibold text-gray-900">Connected Accounts</h2>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-3">
        {accounts.map((account) => {
          const health = getTokenHealth(account.token_expires_at ?? null, !!account.refresh_token)

          return (
            <Card
              key={account.id}
              className="hover:shadow-sm transition-shadow"
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${healthColors[health]}`}
                      title={healthLabels[health]}
                    />
                    <p className="font-medium text-gray-900">
                      {account.display_name || account.email}
                    </p>
                    <Badge variant="default">
                      {account.provider === 'google' ? 'Google' : 'Outlook'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 ml-5">{account.email}</p>
                  <p className="text-xs text-gray-400 ml-5 mt-0.5">
                    Connected {new Date(account.created_at).toLocaleDateString()}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmId(account.id)}
                  loading={disconnecting === account.id}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-4"
                  aria-label={`Disconnect ${account.display_name || account.email}`}
                >
                  {disconnecting === account.id ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="pt-1">
        <Link
          href="/dashboard/accounts"
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another account
        </Link>
      </div>

      <Dialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Disconnect account?"
        description={confirmAccount ? `This will remove "${confirmAccount.display_name || confirmAccount.email}" and all its calendars.` : undefined}
      >
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setConfirmId(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={() => confirmId && handleDisconnect(confirmId)}>
            Disconnect
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
