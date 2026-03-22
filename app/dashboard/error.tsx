'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex items-center justify-center px-4 py-24">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard error</h1>
        <p className="mt-4 text-gray-600">
          Something went wrong loading the dashboard. Your calendars are still syncing in the background.
        </p>
        <button
          onClick={reset}
          className="mt-6 px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
