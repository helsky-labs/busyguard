import Link from 'next/link'
import { Check, Link2, CalendarCheck, Coffee } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-surface">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 max-w-5xl mx-auto">
        <span className="font-display font-bold text-xl text-gray-900">BusyGuard</span>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Login
          </Link>
          <Link
            href="/auth/signup"
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-xs"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 pt-20 pb-24 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-gray-950 sm:text-6xl max-w-3xl">
          Never double-book again
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-gray-600 leading-relaxed">
          BusyGuard syncs your calendars and blocks time automatically. Connect Google Calendar, and busy blocks appear everywhere they need to.
        </p>
        <Link
          href="/auth/signup"
          className="mt-10 bg-primary-600 text-white px-8 py-3.5 rounded-lg font-medium hover:bg-primary-700 active:bg-primary-800 transition-colors shadow-xs text-base"
        >
          Start Free Trial
        </Link>
      </section>

      {/* How it works */}
      <section className="px-4 py-20 bg-[rgb(var(--bg-page))]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            How it works
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              {
                icon: Link2,
                step: '1',
                title: 'Connect',
                desc: 'Link your Google Calendar accounts in one click.',
              },
              {
                icon: CalendarCheck,
                step: '2',
                title: 'Select',
                desc: 'Choose which calendars to keep in sync.',
              },
              {
                icon: Coffee,
                step: '3',
                title: 'Relax',
                desc: 'Busy blocks appear automatically. No more conflicts.',
              },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-24 bg-surface">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-display text-2xl font-bold text-gray-900 sm:text-3xl">Pricing</h2>
          <p className="text-center text-gray-600 mt-3">Simple plans, no surprises.</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 max-w-2xl mx-auto">
            {/* Monthly */}
            <div className="rounded-xl bg-surface border border-gray-200 p-8 shadow-xs hover:-translate-y-0.5 transition-transform">
              <h3 className="font-display font-semibold text-lg text-gray-900">Monthly</h3>
              <p className="mt-4 text-4xl font-bold text-gray-900">
                $9<span className="text-lg font-normal text-gray-500">/mo</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                {['Unlimited calendars', 'Real-time sync via webhooks', 'Multi-account support'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup?plan=monthly"
                className="mt-8 block w-full text-center py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Get Started
              </Link>
            </div>

            {/* Yearly */}
            <div className="rounded-xl bg-surface border-2 border-primary-600 p-8 shadow-sm relative hover:-translate-y-0.5 transition-transform">
              <span className="absolute -top-3 right-4 bg-primary-600 text-white text-xs font-medium px-2.5 py-1 rounded-md">
                Save 20%
              </span>
              <h3 className="font-display font-semibold text-lg text-gray-900">Yearly</h3>
              <p className="mt-4 text-4xl font-bold text-gray-900">
                $7<span className="text-lg font-normal text-gray-500">/mo</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">Billed annually ($84/year)</p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                {['Everything in Monthly', 'Priority support', 'Early access to features'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup?plan=yearly"
                className="mt-8 block w-full text-center py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
