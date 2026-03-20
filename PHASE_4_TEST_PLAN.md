# Phase 4 Option A: Testing & Validation Plan

**Status:** In Progress
**Date Started:** 2026-03-20
**Goal:** Verify Phase 3 implementation works end-to-end

---

## 1. Code Review Checklist

### Sync Engine (`lib/sync-engine.ts`)
- [x] Fetch calendars correctly with admin client
- [x] Loop prevention via `extendedProperties.private.busyguard`
- [x] Time window is -3 to +90 days
- [x] All-day event format preserved (date, not dateTime)
- [x] Orphan cleanup finds and deletes blocks when source events are gone
- [x] Multi-account provider map architecture

### Webhook Handler (`app/api/webhooks/google/route.ts`)
- [x] Validates `x-goog-channel-token` header
- [x] Handles `sync` state (initial ping) with fast 200 return
- [x] Handles `exists` state (event changed) → triggers sync
- [x] Always returns 200 to prevent Google retry loops
- [x] Finds user from webhook channel correctly

### OAuth Callback Updates (`app/api/accounts/google/callback/route.ts`)
- [x] Retrieves calendar IDs from insert response
- [x] Sets up webhook watches for each included calendar
- [x] Stores channel info: `channel_id`, `resource_id`, `expiry`
- [x] Triggers initial `syncCalendars(userId)` after OAuth
- [x] Handles webhook setup errors gracefully

---

## 2. Manual Testing Scenarios

### Scenario 1: Account Connection & Initial Sync
**Setup:** Test Google account with 2-3 calendars

```
Steps:
1. Navigate to /dashboard/accounts
2. Click "Connect Google"
3. Authorize with test account
4. Verify redirect to /dashboard/accounts?connected=google
```

**Verification:**
- [ ] calendar_accounts table has new row with tokens
- [ ] calendars table has rows for each user calendar
- [ ] webhook_channels table has entries for each is_included=true calendar
- [ ] managed_busy_blocks table has rows (initial sync completed)
- [ ] Each busy block event in Google Calendar has extendedProperties.private.busyguard = 'managed'

**Expected Result:**
✓ User sees "Google account connected" message
✓ Dashboard shows connected account with calendar list

---

### Scenario 2: Event Creation → Busy Block Appears
**Setup:** From Scenario 1, connected account with synced calendars

```
Steps:
1. In Google Calendar, create event "Team Meeting" on 2026-03-25 10:00-11:00 in Calendar A
2. Wait 5 seconds (webhook latency)
3. Check other calendars for busy block
```

**Verification:**
- [ ] Busy block appears in all other calendars (not Calendar A)
- [ ] Busy block title is "Team Meeting (Busy)"
- [ ] Busy block time matches source event time
- [ ] Busy block has extendedProperties.private.busyguard = 'managed'
- [ ] managed_busy_blocks table has new row with:
  - source_event_id = source event's Google ID
  - source_calendar_id = Calendar A's ID
  - target_calendar_id = other calendars

**Expected Result:**
✓ Busy block appears within 5 seconds
✓ All verification fields correct
✓ No loop (busy block doesn't trigger another sync)

---

### Scenario 3: Event Update → Busy Block Updates
**Setup:** From Scenario 2, event + busy block exist

```
Steps:
1. In Google Calendar, edit "Team Meeting" to 14:00-15:00
2. Wait 5 seconds
3. Check busy block times in other calendars
```

**Verification:**
- [ ] Busy block time updated to 14:00-15:00 in all target calendars
- [ ] Only one busy block per target calendar (no duplicates)
- [ ] managed_busy_blocks.updated_at is recent

**Expected Result:**
✓ Busy block time reflects source event change

---

### Scenario 4: Event Deletion → Busy Block Deleted
**Setup:** From Scenario 3, event + busy blocks exist

```
Steps:
1. In Google Calendar, delete "Team Meeting"
2. Wait 5 seconds
3. Check other calendars for busy block
```

**Verification:**
- [ ] Busy block is gone from all target calendars
- [ ] managed_busy_blocks row is deleted from DB
- [ ] No "orphaned" entries remain

**Expected Result:**
✓ Busy block automatically cleaned up

---

### Scenario 5: All-Day Event
**Setup:** From Scenario 1, connected account

```
Steps:
1. Create all-day event "Time Off" in Calendar A
2. Wait 5 seconds
3. Check Calendar B for corresponding busy block
```

**Verification:**
- [ ] Busy block appears as all-day event (start.date, not start.dateTime)
- [ ] extendedProperties.private.busyguard = 'managed'
- [ ] managed_busy_blocks row has correct structure

**Expected Result:**
✓ All-day format preserved in busy block

---

### Scenario 6: Rapid Event Updates
**Setup:** From Scenario 1, connected account

```
Steps:
1. Create event "Rapid Test"
2. Update it 5 times in quick succession (change times)
3. Watch busy blocks update in other calendars
```

**Verification:**
- [ ] No duplicate busy blocks created
- [ ] Final busy block reflects final event state
- [ ] No missed updates
- [ ] No 404 errors in webhook handler

**Expected Result:**
✓ All updates processed correctly
✓ Final state is consistent

---

### Scenario 7: Multi-Account Sync
**Setup:** Connect 2 separate Google accounts (if available)

```
Steps:
1. Connect Account A with 2 calendars
2. Connect Account B with 2 calendars
3. Create event in Account A Calendar 1
4. Verify busy block appears in Account A Calendar 2 only (not Account B)
5. Create event in Account B Calendar 1
6. Verify busy block appears in Account B Calendar 2 only
```

**Verification:**
- [ ] provider_map correctly routes to right provider
- [ ] No cross-account busy block creation
- [ ] Sync is isolated per account

**Expected Result:**
✓ Multi-account isolation works correctly

---

## 3. Edge Cases

### Edge Case A: Disabled Calendar
```
Steps:
1. Create event in Calendar A
2. Uncheck "Sync" for Calendar B in settings (future feature)
3. Verify no busy block appears in Calendar B

Note: This may not be testable if UI toggle doesn't exist yet
```

### Edge Case B: Very Long Event
```
Steps:
1. Create event spanning 8 hours
2. Verify busy block in all target calendars spans same 8 hours
3. Update to 12 hours, verify update
```

### Edge Case C: Event in Past
```
Steps:
1. Create event dated 2026-03-10 (within -3 day window)
2. Verify busy block appears
3. Create event dated 2026-02-01 (outside window)
4. Verify busy block does NOT appear (correct behavior)
```

---

## 4. Error Scenarios

### Error Case A: Webhook Validation Failure
```
Steps:
1. Send POST to /api/webhooks/google with invalid token
2. Verify request is rejected (401 or similar)
3. Check no database changes occurred
```

### Error Case B: Calendar Fetch Timeout
```
Steps:
1. (Simulated) Break Google API connection briefly during sync
2. Verify error is logged
3. Verify other calendars continue syncing
4. Verify next webhook retry re-syncs failed calendars
```

### Error Case C: Event with Missing Fields
```
Steps:
1. (If possible) Create event with unusual fields
2. Verify sync doesn't crash
3. Check error is logged
4. Verify sync continues for other events
```

---

## 5. Database Consistency Checks

Run these queries against Supabase to verify state:

```sql
-- Check webhook channels are created
SELECT channel_id, resource_id, calendar_id, expiry
FROM webhook_channels
WHERE user_id = 'YOUR_USER_ID';

-- Check managed busy blocks exist
SELECT source_event_id, source_calendar_id, target_calendar_id, created_at
FROM managed_busy_blocks
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;

-- Verify unique index works (no duplicates)
SELECT source_event_id, source_calendar_id, target_calendar_id, COUNT(*)
FROM managed_busy_blocks
GROUP BY source_event_id, source_calendar_id, target_calendar_id
HAVING COUNT(*) > 1;

-- Check for orphaned blocks (shouldn't exist)
SELECT * FROM managed_busy_blocks
WHERE managed_busy_blocks.created_at < now() - interval '1 hour'
AND source_event_id NOT IN (SELECT event_id FROM synced_events);
```

---

## 6. Performance Metrics

Capture during testing:

- [ ] Initial sync time (from OAuth callback to first busy block)
- [ ] Webhook latency (event changed → busy block appears)
- [ ] Sync time for 10+ calendar account
- [ ] Database query times
- [ ] Google API call counts per sync

---

## 7. Known Issues / Blockers

(To be filled during testing)

- [ ] Issue: ...
- [ ] Blocker: ...

---

## 8. Test Results Summary

### Passed Scenarios
- [ ] Scenario 1: Account Connection ✓/✗
- [ ] Scenario 2: Event Creation ✓/✗
- [ ] Scenario 3: Event Update ✓/✗
- [ ] Scenario 4: Event Deletion ✓/✗
- [ ] Scenario 5: All-Day Event ✓/✗
- [ ] Scenario 6: Rapid Updates ✓/✗
- [ ] Scenario 7: Multi-Account ✓/✗

### Known Limitations Found
- (To be filled)

### Recommendations for Phase 4B (Webhook Renewal)
- (To be filled)

---

## Next Steps

1. **Before Testing**
   - [ ] Ensure .env.local has valid Google credentials
   - [ ] Ensure Supabase project is accessible
   - [ ] Create test Google account (or use personal cautiously)

2. **During Testing**
   - [ ] Keep terminal open with `npm run dev`
   - [ ] Watch Supabase for database changes in real-time
   - [ ] Monitor browser Network tab for webhook POST requests
   - [ ] Check browser console for any errors

3. **After Testing**
   - [ ] Document any issues found
   - [ ] Update STATE.md with test results
   - [ ] Move to Phase 4B (Webhook Renewal) if all tests pass

