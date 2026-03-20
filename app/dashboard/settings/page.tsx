import { createClient } from '@/lib/supabase/server'
import { BillingSection } from '@/components/dashboard/billing-section'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div>
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Account Section */}
      <section className="mt-8 bg-white p-6 rounded-lg shadow-sm">
        <h2 className="font-semibold">Account</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-500">Email</label>
            <p className="mt-1">{user?.email}</p>
          </div>
        </div>
      </section>

      {/* Billing Section */}
      <section className="mt-6 bg-white p-6 rounded-lg shadow-sm">
        <h2 className="font-semibold">Billing</h2>
        <BillingSection />
      </section>

      {/* Danger Zone */}
      <section className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-red-200">
        <h2 className="font-semibold text-red-600">Danger Zone</h2>
        <p className="mt-2 text-sm text-gray-600">
          Once you delete your account, there is no going back.
        </p>
        <button className="mt-4 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
          Delete Account
        </button>
      </section>
    </div>
  )
}
