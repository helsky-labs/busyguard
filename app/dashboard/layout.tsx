import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/dashboard/navbar'
import { Sidebar } from '@/components/dashboard/sidebar'

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
    <div className="min-h-screen bg-[rgb(var(--bg-page))]">
      <Navbar userEmail={user.email || ''} />
      <div className="flex max-w-6xl mx-auto px-6">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <main className="flex-1 py-6 min-w-0">{children}</main>
      </div>
    </div>
  )
}
