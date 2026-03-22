'use client'

import Link from 'next/link'

export function ConnectAccountCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Add More Calendars</h3>
          <p className="text-sm text-gray-600 mt-1">
            Connect additional Google or Outlook accounts
          </p>
        </div>
        <span className="text-2xl">➕</span>
      </div>

      <div className="mt-6 pt-4 border-t">
        <Link
          href="/dashboard/accounts"
          className="inline-block w-full text-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Connect Account
        </Link>
      </div>
    </div>
  )
}
