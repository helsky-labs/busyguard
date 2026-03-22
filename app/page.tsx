import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-transparent">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-16">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            BusyGuard
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="btn-ghost">
              Log in
            </Link>
            <Link href="/auth/signup" className="btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-24 pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-subtle text-accent text-body-sm font-medium mb-8">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-70">
              <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Calendar sync, simplified
          </div>
          <h1 className="text-display max-w-2xl mx-auto">
            Never double-book again
          </h1>
          <p className="mt-6 text-body text-content-secondary max-w-xl mx-auto leading-relaxed">
            BusyGuard syncs your calendars and blocks time automatically.
            Connect Google Calendar, and busy blocks appear everywhere they need to.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/auth/signup" className="btn-primary !px-8 !py-3 !text-base">
              Start Free Trial
            </Link>
            <Link href="#pricing" className="btn-ghost !text-base">
              View Pricing
            </Link>
          </div>
        </div>

        {/* Subtle gradient decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-accent/[0.04] to-transparent rounded-full blur-3xl" />
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect',
                description: 'Link your Google Calendar accounts in seconds with secure OAuth.',
              },
              {
                step: '02',
                title: 'Select',
                description: 'Choose which calendars to sync. Toggle them on or off anytime.',
              },
              {
                step: '03',
                title: 'Relax',
                description: 'Busy blocks sync automatically in real-time via webhooks.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center md:text-left">
                <span className="text-caption font-semibold text-accent">{item.step}</span>
                <h3 className="text-heading-3 mt-2">{item.title}</h3>
                <p className="text-body-sm text-content-secondary mt-2">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-24 bg-surface-secondary">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-heading-1">Simple, transparent pricing</h2>
            <p className="text-body text-content-secondary mt-3">
              Start free. Upgrade when you're ready.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 max-w-2xl mx-auto">
            {/* Monthly */}
            <div className="card p-8">
              <h3 className="text-heading-3">Monthly</h3>
              <p className="mt-4">
                <span className="text-4xl font-bold tracking-tight">$9</span>
                <span className="text-body-sm text-content-tertiary ml-1">/month</span>
              </p>
              <ul className="mt-8 space-y-3">
                {['Unlimited calendars', 'Real-time webhook sync', 'Multi-account support'].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-body-sm">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-success mt-0.5 shrink-0">
                      <path d="M4 9l3.5 3.5L14 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup?plan=monthly"
                className="btn-secondary w-full mt-8"
              >
                Get Started
              </Link>
            </div>

            {/* Yearly */}
            <div className="card p-8 ring-2 ring-content-primary relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="badge-success !px-3 !py-1 font-semibold">Save 20%</span>
              </div>
              <h3 className="text-heading-3">Yearly</h3>
              <p className="mt-4">
                <span className="text-4xl font-bold tracking-tight">$7</span>
                <span className="text-body-sm text-content-tertiary ml-1">/month</span>
              </p>
              <p className="text-caption text-content-tertiary mt-1">Billed annually at $84/year</p>
              <ul className="mt-8 space-y-3">
                {['Everything in Monthly', 'Priority support', 'Early access to features'].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-body-sm">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-success mt-0.5 shrink-0">
                      <path d="M4 9l3.5 3.5L14 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup?plan=yearly"
                className="btn-primary w-full mt-8"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-body-sm text-content-tertiary">BusyGuard</span>
          <span className="text-caption text-content-tertiary">Keep your time safe.</span>
        </div>
      </footer>
    </main>
  )
}
