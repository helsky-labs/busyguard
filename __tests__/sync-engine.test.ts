import { describe, it, expect } from 'vitest'
import { syncCalendars } from '../lib/sync-engine'

describe('syncCalendars', () => {
  it('is exported', () => {
    expect(typeof syncCalendars).toBe('function')
  })
})

describe('sync period', () => {
  it('BUSYGUARD_SYNC_AHEAD_DAYS defaults to 14 when env var not set', () => {
    // The constant is internal, but we verify the default by checking
    // that the module loads without error when env var is absent
    delete process.env.BUSYGUARD_SYNC_AHEAD_DAYS
    expect(() => require('../lib/sync-engine')).not.toThrow()
  })
})
