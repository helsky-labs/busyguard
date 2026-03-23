import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTokenHealth(
  tokenExpiresAt: string | null,
  hasRefreshToken: boolean
): 'healthy' | 'warning' | 'broken' {
  if (!tokenExpiresAt) return hasRefreshToken ? 'healthy' : 'warning'
  const expired = new Date(tokenExpiresAt).getTime() < Date.now()
  if (expired && !hasRefreshToken) return 'broken'
  return 'healthy'
}

export function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
