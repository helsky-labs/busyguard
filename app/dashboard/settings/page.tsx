import { createClient } from '@/lib/supabase/server'
import { BillingSection } from '@/components/dashboard/billing-section'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="max-w-2xl animate-fade-in">
      <h1 className="text-heading-1 mb-2">Settings</h1>
      <p className="text-body-sm text-content-secondary mb-8">
        Manage your account and billing preferences
      </p>

      {/* Account Section */}
      <section className="card mb-4">
        <h2 className="text-heading-3 mb-4">Account</h2>
        <div>
          <label className="section-label">Email</label>
          <p className="text-body mt-1">{user?.email}</p>
        </div>
      </section>

      {/* Billing Section */}
      <section className="card mb-4">
        <h2 className="text-heading-3 mb-4">Billing</h2>
        <BillingSection />
      </section>

      {/* Danger Zone */}
      <section className="card !border-danger/20">
        <h2 className="text-heading-3 text-danger mb-2">Danger Zone</h2>
        <p className="text-body-sm text-content-secondary mb-4">
          Once you delete your account, there is no going back.
        </p>
        <button className="btn-danger">
          Delete Account
        </button>
      </section>
    </div>
  )
}
