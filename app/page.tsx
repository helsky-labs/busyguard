import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <span className="font-bold text-xl">YourSaaS</span>
        <div className="flex gap-4">
          <Link href="/auth/login" className="text-gray-600 hover:text-black">
            Login
          </Link>
          <Link
            href="/auth/signup"
            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Your Product Headline
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-gray-600">
          Explain what your product does and why people should care.
        </p>
        <Link
          href="/auth/signup"
          className="mt-10 bg-black text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800"
        >
          Start Free Trial
        </Link>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold">Pricing</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {/* Monthly */}
            <div className="rounded-lg bg-white p-8 shadow-sm border">
              <h3 className="font-semibold text-lg">Monthly</h3>
              <p className="mt-4 text-4xl font-bold">
                $9<span className="text-lg text-gray-500">/mo</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                <li>Feature one</li>
                <li>Feature two</li>
                <li>Feature three</li>
              </ul>
              <Link
                href="/auth/signup?plan=monthly"
                className="mt-8 block w-full text-center bg-black text-white py-2 rounded-lg hover:bg-gray-800"
              >
                Get Started
              </Link>
            </div>

            {/* Yearly */}
            <div className="rounded-lg bg-white p-8 shadow-sm border-2 border-black">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Yearly</h3>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                  Save 20%
                </span>
              </div>
              <p className="mt-4 text-4xl font-bold">
                $7<span className="text-lg text-gray-500">/mo</span>
              </p>
              <p className="text-sm text-gray-500">Billed annually ($84/year)</p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                <li>Everything in Monthly</li>
                <li>Priority support</li>
                <li>Early access to features</li>
              </ul>
              <Link
                href="/auth/signup?plan=yearly"
                className="mt-8 block w-full text-center bg-black text-white py-2 rounded-lg hover:bg-gray-800"
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
