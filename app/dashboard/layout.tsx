import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/dashboard" className="font-bold text-xl">
            YourSaaS
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Sidebar + Content */}
      <div className="flex max-w-6xl mx-auto">
        {/* Sidebar */}
        <aside className="w-48 p-6">
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className="block px-3 py-2 rounded-lg text-sm hover:bg-white"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/accounts"
              className="block px-3 py-2 rounded-lg text-sm hover:bg-white"
            >
              Accounts
            </Link>
            <Link
              href="/dashboard/settings"
              className="block px-3 py-2 rounded-lg text-sm hover:bg-white"
            >
              Settings
            </Link>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
