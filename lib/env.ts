function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Check your .env.local file or deployment environment.`
    )
  }
  return value
}

/** Server-only environment variables — validated at first access */
export const serverEnv = {
  get GOOGLE_CLIENT_ID() {
    return requireEnv('GOOGLE_CLIENT_ID')
  },
  get GOOGLE_CLIENT_SECRET() {
    return requireEnv('GOOGLE_CLIENT_SECRET')
  },
  get GOOGLE_REDIRECT_URI() {
    return requireEnv('GOOGLE_REDIRECT_URI')
  },
  get GOOGLE_WEBHOOK_TOKEN() {
    return requireEnv('GOOGLE_WEBHOOK_TOKEN')
  },
  get SUPABASE_URL() {
    return requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  },
  get SUPABASE_ANON_KEY() {
    return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  },
  get CRON_SECRET() {
    return requireEnv('CRON_SECRET')
  },
  get ADMIN_API_KEY() {
    return requireEnv('ADMIN_API_KEY')
  },
} as const

/** Public environment variables (available in browser) */
export const publicEnv = {
  get APP_URL() {
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, '')}`
    return 'http://localhost:3000'
  },
  get APP_NAME() {
    return process.env.NEXT_PUBLIC_APP_NAME ?? 'BusyGuard'
  },
} as const
