'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function BillingSection() {
  const [loading, setLoading] = useState(false)

  const handleManageBilling = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Error opening billing portal:', error)
    }
    setLoading(false)
  }

  const handleUpgrade = async (priceId: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const { url } = await res.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Error creating checkout:', error)
    }
    setLoading(false)
  }

  // TODO: Fetch actual subscription status
  const hasSubscription = false

  return (
    <div className="mt-4">
      {hasSubscription ? (
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-600">Current plan:</p>
            <Badge variant="primary">Pro</Badge>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleManageBilling}
            loading={loading}
            className="mt-4"
          >
            Manage Billing
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm text-gray-600">Current plan:</p>
            <Badge variant="default">Free</Badge>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Upgrade to unlock all features.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY!)}
              loading={loading}
              size="sm"
            >
              Monthly ($9/mo)
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY!)}
              loading={loading}
              size="sm"
            >
              Yearly ($84/yr)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
