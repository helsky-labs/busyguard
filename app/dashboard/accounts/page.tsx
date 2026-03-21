'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CalendarAccount {
  id: string
  provider: 'google' | 'microsoft'
  email: string
  display_name: string
  created_at: string
}

export default function AccountsPage() {
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<CalendarAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const successMessage = searchParams.get('connected')
    ? `Successfully connected ${searchParams.get('connected')} account!`
    : null

  useEffect(() => {
    const fetchAccounts = async () => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('calendar_accounts')
        .select('id, provider, email, display_name, created_at')
        .order('created_at', { ascending: false })

      setAccounts(data || [])
      setLoading(false)
    }

    fetchAccounts()
  }, [])

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return

    setDisconnecting(accountId)
    try {
      const response = await fetch('/api/accounts/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })

      if (response.ok) {
        setAccounts(accounts.filter((a) => a.id !== accountId))
      } else {
        alert('Failed to disconnect account')
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      alert('Failed to disconnect account')
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Calendar Accounts</h1>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Calendar Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Google Calendar</h2>
              <p className="text-sm text-gray-600 mt-1">Connect your Google Calendar to sync events</p>
            </div>
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-lg">🔴</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t">
            <a
              href="/api/accounts/google/connect"
              className="w-full inline-block text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Connect Google
            </a>
          </div>
        </div>

        {/* Microsoft Calendar Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Microsoft Outlook</h2>
              <p className="text-sm text-gray-600 mt-1">Connect your Outlook calendar to sync events</p>
            </div>
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-lg">⚪</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t">
            <button
              disabled
              className="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>

      {/* Connected Accounts List */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Connected Accounts</h2>

        {loading ? (
          <p className="text-gray-600 text-center py-8">Loading accounts...</p>
        ) : accounts.length === 0 ? (
          <p className="text-gray-600 text-center py-8 bg-gray-50 rounded-lg">
            No accounts connected yet. Connect your first calendar above to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {account.display_name || account.email}
                  </p>
                  <p className="text-sm text-gray-600">{account.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Connected on {new Date(account.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDisconnect(account.id)}
                  disabled={disconnecting === account.id}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {disconnecting === account.id ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
