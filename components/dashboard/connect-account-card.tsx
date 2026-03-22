'use client'

import Link from 'next/link'

export function ConnectAccountCard() {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-heading-3">Add More Calendars</h3>
          <p className="text-body-sm text-content-secondary mt-1">
            Connect additional calendar accounts
          </p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-surface-secondary flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 4v10M4 9h10"/>
          </svg>
        </div>
      </div>

      <Link href="/dashboard/accounts" className="btn-accent w-full">
        Connect Account
      </Link>
    </div>
  )
}
