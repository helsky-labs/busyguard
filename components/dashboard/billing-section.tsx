'use client'

import { useState } from 'react'

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
          <p className="text-sm text-gray-600">
            You're on the <strong>Pro</strong> plan.
          </p>
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="mt-4 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Manage Billing'}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600">
            You're on the free plan. Upgrade to unlock all features.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY!)}
              disabled={loading}
              className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              Upgrade Monthly ($9/mo)
            </button>
            <button
              onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY!)}
              disabled={loading}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Upgrade Yearly ($84/yr)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
