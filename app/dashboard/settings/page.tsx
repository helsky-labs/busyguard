'use client'

import { useState, useEffect } from 'react'
import { Mail, CreditCard, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BillingSection } from '@/components/dashboard/billing-section'
import { Dialog, DialogFooter } from '@/components/ui/dialog'

export default function SettingsPage() {
  const [showDelete, setShowDelete] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
    })
  }, [])

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Manage your account and billing</p>
      </div>

      {/* Account Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Mail className="h-4 w-4 text-gray-500" />
            <h2 className="font-display font-semibold text-gray-900">Account</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide font-medium">Email</label>
            <p className="mt-1 text-gray-900">{email || '...'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Billing Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-4 w-4 text-gray-500" />
            <h2 className="font-display font-semibold text-gray-900">Billing</h2>
          </div>
        </CardHeader>
        <CardContent>
          <BillingSection />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader className="border-red-100">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-display font-semibold text-red-600">Danger Zone</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Once you delete your account, there is no going back.
          </p>
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete your account?"
        description="This action is permanent. All your connected accounts, calendars, and busy blocks will be permanently deleted."
      >
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm">
            Delete Account
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
