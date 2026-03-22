'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-danger-subtle flex items-center justify-center mx-auto mb-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-danger">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
        </div>
        <h1 className="text-heading-1">Something went wrong</h1>
        <p className="mt-3 text-body text-content-secondary">
          An unexpected error occurred. Please try again.
        </p>
        <button onClick={reset} className="btn-primary mt-8">
          Try again
        </button>
      </div>
    </div>
  )
}
