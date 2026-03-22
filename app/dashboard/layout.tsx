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
    <div className="min-h-screen bg-surface-secondary">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b">
        <div className="flex items-center justify-between max-w-6xl mx-auto px-6 h-14">
          <Link href="/dashboard" className="font-semibold text-base tracking-tight">
            BusyGuard
          </Link>
          <div className="flex items-center gap-5">
            <span className="text-body-sm text-content-tertiary hidden sm:block">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Sidebar + Content */}
      <div className="flex max-w-6xl mx-auto">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 py-6 pl-6 pr-3 hidden md:block">
          <nav className="space-y-1">
            {[
              { href: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
              { href: '/dashboard/accounts', label: 'Accounts', icon: AccountsIcon },
              { href: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-body-sm text-content-secondary hover:bg-surface-elevated hover:text-content-primary transition-colors"
              >
                <item.icon />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/80 backdrop-blur-lg border-t">
          <nav className="flex justify-around py-2">
            {[
              { href: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
              { href: '/dashboard/accounts', label: 'Accounts', icon: AccountsIcon },
              { href: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-4 py-1.5 text-content-secondary"
              >
                <item.icon />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Main content */}
        <main className="flex-1 p-6 pb-24 md:pb-6 min-w-0">{children}</main>
      </div>
    </div>
  )
}

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="5.5" height="5.5" rx="1.5"/>
      <rect x="10.5" y="2" width="5.5" height="5.5" rx="1.5"/>
      <rect x="2" y="10.5" width="5.5" height="5.5" rx="1.5"/>
      <rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1.5"/>
    </svg>
  )
}

function AccountsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 15.75v-1.5a3 3 0 00-3-3H6a3 3 0 00-3 3v1.5"/>
      <circle cx="9" cy="5.25" r="3"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.25"/>
      <path d="M14.7 11.1a1.2 1.2 0 00.24 1.32l.04.04a1.44 1.44 0 11-2.04 2.04l-.04-.04a1.2 1.2 0 00-1.32-.24 1.2 1.2 0 00-.72 1.1v.12a1.44 1.44 0 11-2.88 0v-.06a1.2 1.2 0 00-.78-1.1 1.2 1.2 0 00-1.32.24l-.04.04a1.44 1.44 0 11-2.04-2.04l.04-.04a1.2 1.2 0 00.24-1.32 1.2 1.2 0 00-1.1-.72H3.44a1.44 1.44 0 110-2.88h.06a1.2 1.2 0 001.1-.78 1.2 1.2 0 00-.24-1.32l-.04-.04a1.44 1.44 0 112.04-2.04l.04.04a1.2 1.2 0 001.32.24h.06a1.2 1.2 0 00.72-1.1V3.44a1.44 1.44 0 012.88 0v.06a1.2 1.2 0 00.72 1.1 1.2 1.2 0 001.32-.24l.04-.04a1.44 1.44 0 112.04 2.04l-.04.04a1.2 1.2 0 00-.24 1.32v.06a1.2 1.2 0 001.1.72h.12a1.44 1.44 0 010 2.88h-.06a1.2 1.2 0 00-1.1.72z"/>
    </svg>
  )
}
