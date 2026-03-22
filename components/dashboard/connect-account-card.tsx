'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function ConnectAccountCard() {
  return (
    <Card className="border-dashed border-gray-300 hover:border-gray-400 hover:shadow-sm transition-all">
      <CardContent>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 text-sm">Add More Calendars</h3>
            <p className="text-xs text-gray-500 mt-1">
              Connect additional Google or Outlook accounts
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/accounts"
          className="mt-4 block w-full text-center py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Connect Account
        </Link>
      </CardContent>
    </Card>
  )
}
