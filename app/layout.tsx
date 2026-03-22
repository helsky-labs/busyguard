import type { Metadata } from 'next'
import { Inter, DM_Sans } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: {
    default: 'BusyGuard',
    template: '%s | BusyGuard',
  },
  description: 'Keep your calendars in sync. BusyGuard blocks time across all your calendars so you never double-book.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${dmSans.variable} font-body`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
