import { describe, it, expect } from 'vitest'
import { isManagedEvent } from '../lib/sync-engine'
import type { GoogleEvent } from '../lib/providers/google'

function makeEvent(overrides: Partial<GoogleEvent> = {}): GoogleEvent {
  return {
    id: 'evt-1',
    summary: 'Team standup',
    description: null,
    start: { dateTime: '2026-03-22T10:00:00Z' },
    end: { dateTime: '2026-03-22T10:30:00Z' },
    ...overrides,
  }
}

describe('isManagedEvent', () => {
  it('detects extendedProperties marker', () => {
    const event = makeEvent({
      extendedProperties: { private: { busyguard: 'managed' } },
    })
    expect(isManagedEvent(event)).toBe(true)
  })

  it('detects summary + description pattern', () => {
    const event = makeEvent({
      summary: 'Busy',
      description: '[BusyGuard] Managed by BusyGuard — do not edit',
    })
    expect(isManagedEvent(event)).toBe(true)
  })

  it('returns false for normal events', () => {
    const event = makeEvent({ summary: 'Team standup' })
    expect(isManagedEvent(event)).toBe(false)
  })

  it('returns false for "Busy" without BusyGuard description', () => {
    const event = makeEvent({
      summary: 'Busy',
      description: 'Personal time',
    })
    expect(isManagedEvent(event)).toBe(false)
  })

  it('returns false for "Busy" with no description', () => {
    const event = makeEvent({
      summary: 'Busy',
      description: null,
    })
    expect(isManagedEvent(event)).toBe(false)
  })

  it('handles extendedProperties: undefined', () => {
    const event = makeEvent({ extendedProperties: undefined })
    expect(isManagedEvent(event)).toBe(false)
  })

  it('handles extendedProperties with empty private', () => {
    const event = makeEvent({
      extendedProperties: { private: {} },
    })
    expect(isManagedEvent(event)).toBe(false)
  })
})
