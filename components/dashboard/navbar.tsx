'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface NavbarProps {
  userEmail: string
}

export function Navbar({ userEmail }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const initial = userEmail.charAt(0).toUpperCase()

  return (
    <nav className="bg-surface border-b border-gray-200 px-6 h-14 flex items-center">
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
        <Link href="/dashboard" className="font-display font-bold text-lg text-gray-900">
          BusyGuard
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
              {initial}
            </div>
            <span className="text-sm text-gray-600 hidden sm:block">{userEmail}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  )
}
