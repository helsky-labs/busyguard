import { NextRequest, NextResponse } from 'next/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

export function validateAdminAuth(
  request: NextRequest
): { valid: true } | { valid: false; response: NextResponse } {
  const authHeader = request.headers.get('authorization')

  if (!authHeader) {
    logger.warn('Admin request missing authorization header', {
      path: request.nextUrl.pathname,
    })
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      ),
    }
  }

  const expectedToken = `Bearer ${serverEnv.ADMIN_API_KEY}`

  if (authHeader !== expectedToken) {
    logger.warn('Admin request with invalid API key', {
      path: request.nextUrl.pathname,
    })
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      ),
    }
  }

  return { valid: true }
}
