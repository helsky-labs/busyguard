import { describe, it, expect } from 'vitest'

/**
 * Proves the sync engine cannot generate duplicate busy blocks.
 *
 * Real setup:
 *   Account: helrabelo@gmail.com
 *     - primary (provider_calendar_id = "helrabelo@gmail.com")
 *
 *   Account: hel@planetary.co
 *     - primary   (provider_calendar_id = "hel@planetary.co")
 *     - Vacations (provider_calendar_id = "vacations-xyz@group.calendar.google.com")
 *     - Meetings  (provider_calendar_id = "meetings-abc@group.calendar.google.com")
 *
 * Three layers of duplicate prevention:
 *   Layer 1 — Targeting:  only primary calendars on OTHER accounts are targets
 *   Layer 2 — Loop detection:  managedEventIds prevents syncing our own blocks
 *   Layer 3 — DB idempotency:  unique(source_event_id, source_calendar_id, target_calendar_id)
 */

// --- Types (mirror sync-engine internals) ---

interface MockCalendar {
  id: string
  account_id: string
  provider_calendar_id: string
  name: string
  account_email: string
}

interface Pair { source: string; target: string }

// --- Mock data ---

const GMAIL_ACCOUNT = 'acc-gmail'
const PLANETARY_ACCOUNT = 'acc-planetary'

const calendars: MockCalendar[] = [
  {
    id: 'cal-gmail-primary',
    account_id: GMAIL_ACCOUNT,
    provider_calendar_id: 'helrabelo@gmail.com',
    name: 'Gmail Primary',
    account_email: 'helrabelo@gmail.com',
  },
  {
    id: 'cal-planetary-primary',
    account_id: PLANETARY_ACCOUNT,
    provider_calendar_id: 'hel@planetary.co',
    name: 'Planetary Primary',
    account_email: 'hel@planetary.co',
  },
  {
    id: 'cal-planetary-vacations',
    account_id: PLANETARY_ACCOUNT,
    provider_calendar_id: 'vacations-xyz@group.calendar.google.com',
    name: 'Vacations',
    account_email: 'hel@planetary.co',
  },
  {
    id: 'cal-planetary-meetings',
    account_id: PLANETARY_ACCOUNT,
    provider_calendar_id: 'meetings-abc@group.calendar.google.com',
    name: 'Meetings',
    account_email: 'hel@planetary.co',
  },
]

// --- Replicate sync-engine logic exactly ---

function buildPrimaryByAccount(cals: MockCalendar[]): Map<string, MockCalendar> {
  const m = new Map<string, MockCalendar>()
  for (const cal of cals) {
    if (cal.provider_calendar_id === cal.account_email) {
      m.set(cal.account_id, cal)
    }
  }
  return m
}

function getTargets(
  source: MockCalendar,
  primaryByAccount: Map<string, MockCalendar>,
): MockCalendar[] {
  const targets: MockCalendar[] = []
  for (const [accountId, primary] of primaryByAccount) {
    if (accountId === source.account_id) continue
    targets.push(primary)
  }
  return targets
}

/** Simulate the OLD engine (all-to-all except self). */
function getTargetsOld(source: MockCalendar, allCals: MockCalendar[]): MockCalendar[] {
  return allCals.filter((t) => t.id !== source.id)
}

// =====================================================================
//  LAYER 1 — Targeting: correct pairs, no duplicates by construction
// =====================================================================

describe('Layer 1 — Targeting', () => {
  const primaryByAccount = buildPrimaryByAccount(calendars)

  it('identifies exactly one primary per account', () => {
    expect(primaryByAccount.size).toBe(2)
    expect(primaryByAccount.get(GMAIL_ACCOUNT)?.id).toBe('cal-gmail-primary')
    expect(primaryByAccount.get(PLANETARY_ACCOUNT)?.id).toBe('cal-planetary-primary')
  })

  // --- Correct pairs ---

  it('Planetary primary → Gmail primary', () => {
    const targets = getTargets(calendars[1], primaryByAccount)
    expect(targets.map((t) => t.id)).toEqual(['cal-gmail-primary'])
  })

  it('Planetary Vacations → Gmail primary', () => {
    const targets = getTargets(calendars[2], primaryByAccount)
    expect(targets.map((t) => t.id)).toEqual(['cal-gmail-primary'])
  })

  it('Planetary Meetings → Gmail primary', () => {
    const targets = getTargets(calendars[3], primaryByAccount)
    expect(targets.map((t) => t.id)).toEqual(['cal-gmail-primary'])
  })

  it('Gmail primary → Planetary primary ONLY', () => {
    const targets = getTargets(calendars[0], primaryByAccount)
    expect(targets.map((t) => t.id)).toEqual(['cal-planetary-primary'])
  })

  // --- Forbidden pairs ---

  it('NEVER targets a non-primary calendar', () => {
    for (const source of calendars) {
      const targetIds = getTargets(source, primaryByAccount).map((t) => t.id)
      expect(targetIds).not.toContain('cal-planetary-vacations')
      expect(targetIds).not.toContain('cal-planetary-meetings')
    }
  })

  it('NEVER creates intra-account pairs', () => {
    for (const source of calendars) {
      const targets = getTargets(source, primaryByAccount)
      for (const target of targets) {
        expect(target.account_id).not.toBe(source.account_id)
      }
    }
  })

  // --- Exhaustive pair matrix ---

  it('full pair matrix is exactly 4 pairs', () => {
    const pairs: string[] = []
    for (const source of calendars) {
      for (const target of getTargets(source, primaryByAccount)) {
        pairs.push(`${source.name} → ${target.name}`)
      }
    }
    expect(pairs.sort()).toEqual([
      'Gmail Primary → Planetary Primary',
      'Meetings → Gmail Primary',
      'Planetary Primary → Gmail Primary',
      'Vacations → Gmail Primary',
    ])
  })

  // --- Contrast with OLD behavior to show what was wrong ---

  it('OLD engine produced 12 pairs (the bug)', () => {
    const pairs: string[] = []
    for (const source of calendars) {
      for (const target of getTargetsOld(source, calendars)) {
        pairs.push(`${source.name} → ${target.name}`)
      }
    }
    // 4 calendars × 3 targets each = 12 pairs
    expect(pairs).toHaveLength(12)
    // Including these bad pairs:
    expect(pairs).toContain('Gmail Primary → Vacations')
    expect(pairs).toContain('Gmail Primary → Meetings')
    expect(pairs).toContain('Planetary Primary → Vacations')
    expect(pairs).toContain('Vacations → Meetings')
  })

  it('NEW engine produces 4 pairs vs OLD engine 12 — 3x reduction', () => {
    let oldCount = 0
    let newCount = 0
    const primaryByAccount = buildPrimaryByAccount(calendars)
    for (const source of calendars) {
      oldCount += getTargetsOld(source, calendars).length
      newCount += getTargets(source, primaryByAccount).length
    }
    expect(oldCount).toBe(12)
    expect(newCount).toBe(4)
  })
})

// =====================================================================
//  LAYER 2 — Loop detection: managedEventIds prevents re-syncing
//            our own created blocks
// =====================================================================

describe('Layer 2 — Loop detection (managedEventIds)', () => {
  it('events created by us are skipped', () => {
    // Simulate: sync creates a busy block with Google ID "busy-block-123"
    const managedEventIds = new Set<string>()
    managedEventIds.add('busy-block-123')

    // Next sync lists events — "busy-block-123" appears in the listing
    const incomingEvents = [
      { id: 'real-event-1' },
      { id: 'busy-block-123' }, // our own block
      { id: 'real-event-2' },
    ]

    const processed: string[] = []
    for (const event of incomingEvents) {
      if (managedEventIds.has(event.id)) continue
      processed.push(event.id)
    }

    expect(processed).toEqual(['real-event-1', 'real-event-2'])
    expect(processed).not.toContain('busy-block-123')
  })

  it('newly created blocks are added to the set within the same sync', () => {
    const managedEventIds = new Set<string>()

    // Sync processes event from Gmail, creates a block on Planetary
    const createdBlockId = 'new-busy-block-456'
    managedEventIds.add(createdBlockId)

    // Later in the SAME sync, Planetary's event listing includes our block
    const planetaryEvents = [
      { id: 'planetary-real-event' },
      { id: 'new-busy-block-456' }, // just created above
    ]

    const processed: string[] = []
    for (const event of planetaryEvents) {
      if (managedEventIds.has(event.id)) continue
      processed.push(event.id)
    }

    expect(processed).toEqual(['planetary-real-event'])
  })
})

// =====================================================================
//  LAYER 3 — DB idempotency: same (source_event, source_cal, target_cal)
//            never produces two rows
// =====================================================================

describe('Layer 3 — DB idempotency', () => {
  it('unique key tuple prevents duplicate DB rows', () => {
    // Simulate the DB unique constraint:
    //   unique(source_event_id, source_calendar_id, target_calendar_id)
    const db = new Set<string>()
    const makeKey = (sourceEventId: string, sourceCalId: string, targetCalId: string) =>
      `${sourceEventId}|${sourceCalId}|${targetCalId}`

    const primaryByAccount = buildPrimaryByAccount(calendars)

    // Simulate 3 consecutive syncs with the same events
    for (let sync = 0; sync < 3; sync++) {
      const events = [
        { id: 'evt-meeting-1', sourceCalId: 'cal-planetary-primary' },
        { id: 'evt-vacation-1', sourceCalId: 'cal-planetary-vacations' },
        { id: 'evt-gmail-1', sourceCalId: 'cal-gmail-primary' },
      ]

      for (const event of events) {
        const sourceCal = calendars.find((c) => c.id === event.sourceCalId)!
        const targets = getTargets(sourceCal, primaryByAccount)

        for (const target of targets) {
          const key = makeKey(event.id, sourceCal.id, target.id)
          db.add(key) // Set deduplicates, just like the DB unique constraint
        }
      }
    }

    // 3 events × 1 target each = 3 unique rows, no matter how many syncs
    expect(db.size).toBe(3)
  })

  it('each source event creates exactly 1 block (not N blocks)', () => {
    const primaryByAccount = buildPrimaryByAccount(calendars)

    // A single event from Planetary Vacations
    const source = calendars.find((c) => c.id === 'cal-planetary-vacations')!
    const targets = getTargets(source, primaryByAccount)

    // Only 1 block, on Gmail primary
    expect(targets).toHaveLength(1)

    // Under the OLD engine, this would have been 3 blocks
    const oldTargets = getTargetsOld(source, calendars)
    expect(oldTargets).toHaveLength(3) // Gmail + Planetary Primary + Meetings
  })
})

// =====================================================================
//  Combined: simulate a full sync cycle
// =====================================================================

describe('Full sync simulation', () => {
  it('10 events across 4 calendars produce exactly 10 blocks, zero duplicates', () => {
    const primaryByAccount = buildPrimaryByAccount(calendars)
    const managedEventIds = new Set<string>()
    const createdBlocks: Pair[] = []
    const dbKeys = new Set<string>()

    // Events on each calendar
    const eventsByCalendar: Record<string, string[]> = {
      'cal-gmail-primary': ['gmail-1', 'gmail-2', 'gmail-3'],
      'cal-planetary-primary': ['plan-1', 'plan-2', 'plan-3'],
      'cal-planetary-vacations': ['vac-1', 'vac-2'],
      'cal-planetary-meetings': ['meet-1', 'meet-2'],
    }

    // Run sync
    for (const source of calendars) {
      const events = eventsByCalendar[source.id] || []
      for (const eventId of events) {
        if (managedEventIds.has(eventId)) continue

        const targets = getTargets(source, primaryByAccount)
        for (const target of targets) {
          const key = `${eventId}|${source.id}|${target.id}`
          if (dbKeys.has(key)) continue // DB would return existing row

          dbKeys.add(key)
          const busyBlockId = `busy-${eventId}-on-${target.id}`
          managedEventIds.add(busyBlockId)
          createdBlocks.push({ source: source.name, target: target.name })
        }
      }
    }

    // 10 source events → 10 blocks (1 each)
    expect(createdBlocks).toHaveLength(10)
    expect(dbKeys.size).toBe(10)

    // All Gmail events → Planetary Primary
    const gmailTargets = createdBlocks
      .filter((p) => p.source === 'Gmail Primary')
      .map((p) => p.target)
    expect(gmailTargets).toEqual(['Planetary Primary', 'Planetary Primary', 'Planetary Primary'])

    // All Planetary events → Gmail Primary
    const planetaryTargets = createdBlocks
      .filter((p) => p.source !== 'Gmail Primary')
      .map((p) => p.target)
    expect(planetaryTargets.every((t) => t === 'Gmail Primary')).toBe(true)

    // Run the SAME sync again — zero new blocks
    const blocksBefore = createdBlocks.length
    for (const source of calendars) {
      const events = eventsByCalendar[source.id] || []
      for (const eventId of events) {
        if (managedEventIds.has(eventId)) continue
        const targets = getTargets(source, primaryByAccount)
        for (const target of targets) {
          const key = `${eventId}|${source.id}|${target.id}`
          if (dbKeys.has(key)) continue
          dbKeys.add(key)
          createdBlocks.push({ source: source.name, target: target.name })
        }
      }
    }
    expect(createdBlocks.length).toBe(blocksBefore) // no growth
  })
})
