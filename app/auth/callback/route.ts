import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const plan = searchParams.get('plan')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Redirect to dashboard (with plan if provided)
  const redirectUrl = plan
    ? `${origin}/dashboard?plan=${plan}`
    : `${origin}/dashboard`

  return NextResponse.redirect(redirectUrl)
}
