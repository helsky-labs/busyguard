# Manual Testing Guide for Phase 3

**Duration:** 30-60 minutes
**Prerequisites:**
- BusyGuard dev server running (`npm run dev`)
- Supabase project active and accessible
- Test Google account (separate from personal if possible)
- Google Calendar open in browser

---

## Pre-Test Checklist

Before starting, verify:

```bash
# In busyguard directory:
npm run build          # Should complete with "ok (no errors)"
npm run dev            # Should start on http://localhost:3000
```

Keep these open:
1. **Terminal with `npm run dev`** — Watch for logs
2. **Browser: localhost:3000** — Main app
3. **Browser: calendar.google.com** — Test Google Calendar
4. **Browser: Supabase Dashboard** — Check database in real-time

---

## Test Setup

### 1. Create Test Google Account (Optional)

If using personal account:
- Create a test calendar named "Test Calendar A" and "Test Calendar B"
- Or use existing calendars but be careful with real events

If creating new account:
- Sign up for Gmail account: `testbusyguard+[yourname]@gmail.com`
- Create 2-3 test calendars for isolation
- Note: Allow 30 seconds for Google to sync new calendars

### 2. Verify .env.local

Check that these are set:
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_WEBHOOK_TOKEN=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Scenario 1: Account Connection & Initial Sync

### Expected Result
- User connects Google account
- Calendars appear in database
- Webhooks are set up
- Initial busy blocks are created

### Test Steps

**Step 1a: Access Dashboard**
```
1. Go to http://localhost:3000/dashboard/accounts
2. You should see a "Connect Google" button
3. If you see an error, check console logs
```

**Step 1b: Connect Google**
```
1. Click "Connect Google"
2. You're redirected to Google OAuth consent screen
3. Choose test account if you created one
4. Click "Allow" on permissions
5. Check app logs for errors like "Failed to store calendars" or "Failed to set up watch"
```

**Expected Logs:**
```
✓ Calendar account created
✓ Calendars inserted successfully
✓ setupWatch() called for each calendar
✓ Initial syncCalendars() completed
✓ Redirect to /dashboard/accounts?connected=google
```

**Step 1c: Verify Database**

In Supabase dashboard:

```sql
-- Verify account created
SELECT id, email, provider FROM calendar_accounts
WHERE user_id = '(your user ID)';

-- Verify calendars inserted (primary should be is_included=true)
SELECT id, name, provider_calendar_id, is_included FROM calendars
WHERE user_id = '(your user ID)';

-- Verify webhooks set up
SELECT channel_id, resource_id, expiry FROM webhook_channels
WHERE calendar_id IN (
  SELECT id FROM calendars WHERE user_id = '(your user ID)'
);

-- Check if any busy blocks were created (initial sync)
SELECT COUNT(*) FROM managed_busy_blocks
WHERE user_id = '(your user ID)';
```

**Verification Checklist:**
- [ ] Account row created with email
- [ ] At least 2 calendar rows (primary + others)
- [ ] Primary calendar has is_included = true
- [ ] Webhook channel rows exist with future expiry dates
- [ ] At least 1 managed_busy_blocks row (if user has events)

**If Something Failed:**

| Error | Cause | Fix |
|-------|-------|-----|
| "Failed to store calendars" | DB permission or schema issue | Check Supabase logs, verify schema migration ran |
| "Failed to set up watch" | Google API error | Check `GOOGLE_WEBHOOK_TOKEN`, ensure it's 32+ chars |
| "Error during initial sync" | Calendar fetch failed | Check Google API credentials |

---

## Scenario 2: Event Creation → Busy Block Appears

### Expected Result
- Create event in Calendar A
- Busy block appears in Calendar B within 5 seconds
- Database tracks the relationship
- Loop prevention prevents duplicate blocks

### Test Steps

**Step 2a: Create Test Event**
```
1. Go to calendar.google.com
2. Select "Test Calendar A" (or your first included calendar)
3. Create event:
   - Title: "Test Meeting"
   - Date/Time: Tomorrow 2:00 PM - 3:00 PM
   - Save
4. Return to busyguard logs, watch for webhook trigger
```

**Expected Logs:**
```
✓ POST /api/webhooks/google received
✓ Calendar event changed, triggering sync
✓ syncCalendars() called
✓ Created busy block in target calendar
```

**Step 2b: Check Google Calendar**
```
1. In calendar.google.com, select "Test Calendar B"
2. Look for "Busy" event on same date/time
3. If not visible, refresh page (5-10 second delay possible)
4. Click on "Busy" event, check details
```

**Verification Checklist:**
- [ ] Busy block appears in Calendar B
- [ ] Title is "Busy" (not showing source event name)
- [ ] Time matches source event (2:00 PM - 3:00 PM)
- [ ] No busy block appears in Calendar A (source)

**Step 2c: Verify Extended Properties**

In Google Calendar, click the "Busy" event and check if you can view extended properties:

```
Look for: extendedProperties.private.busyguard = 'managed'
```

If not visible in UI, verify in Supabase:

```sql
-- Check managed_busy_blocks table
SELECT source_event_id, source_calendar_id, target_calendar_id,
       event_start, event_end, created_at
FROM managed_busy_blocks
WHERE user_id = '(your user ID)'
ORDER BY created_at DESC
LIMIT 1;
```

**Verification Checklist:**
- [ ] managed_busy_blocks row has correct source/target calendar IDs
- [ ] event_start and event_end match your test event times
- [ ] created_at is recent (within last minute)

**If Busy Block Didn't Appear:**

| Issue | Debug Steps |
|-------|------------|
| No busy block after 30s | Check browser Network tab for POST to `/api/webhooks/google` (should see 200 response) |
| Webhook POST missing | Verify GOOGLE_WEBHOOK_TOKEN is correct and matches .env |
| POST 401 response | Token mismatch - check ENV variables |
| POST 200 but no block | Check server logs for sync errors, check Supabase DB |

---

## Scenario 3: Event Update → Busy Block Updates

### Expected Result
- Update source event time
- Busy block in target calendars updates automatically
- No duplicate blocks created

### Test Steps

**Step 3a: Edit Event Time**
```
1. In calendar.google.com, click "Test Meeting" in Calendar A
2. Edit: Change time to 3:00 PM - 4:00 PM
3. Save
4. Watch logs for webhook trigger
```

**Expected Logs:**
```
✓ POST /api/webhooks/google received
✓ Calendar event changed, triggering sync
✓ Updated busy block (times changed)
```

**Step 3b: Verify Update**
```
1. In calendar.google.com, click "Busy" in Calendar B
2. Verify time is now 3:00 PM - 4:00 PM
```

**Verification Checklist:**
- [ ] Busy block time updated to 3:00 PM - 4:00 PM
- [ ] Only ONE busy block in Calendar B (no duplicates)
- [ ] managed_busy_blocks.updated_at is recent

**Step 3c: Verify No Duplicates**

```sql
-- Check for duplicate busy blocks
SELECT source_event_id, target_calendar_id, COUNT(*) as count
FROM managed_busy_blocks
WHERE user_id = '(your user ID)'
GROUP BY source_event_id, target_calendar_id
HAVING COUNT(*) > 1;

-- Should return empty result
```

---

## Scenario 4: Event Deletion → Busy Block Deleted

### Expected Result
- Delete source event
- Busy block automatically removed from target calendars
- Database record cleaned up

### Test Steps

**Step 4a: Delete Source Event**
```
1. In calendar.google.com, click "Test Meeting" in Calendar A
2. Delete event
3. Watch logs for webhook trigger
```

**Expected Logs:**
```
✓ POST /api/webhooks/google received
✓ Calendar event changed, triggering sync
✓ Cleaned up orphaned block
```

**Step 4b: Verify Deletion**
```
1. In calendar.google.com, check Calendar B
2. "Busy" event should be gone
3. Refresh page if needed (5-10 second delay)
```

**Verification Checklist:**
- [ ] Busy block gone from Calendar B
- [ ] managed_busy_blocks row deleted from DB
- [ ] No orphaned entries remain

```sql
-- Verify block was deleted
SELECT COUNT(*) FROM managed_busy_blocks
WHERE source_event_id = '(source event id)';

-- Should return 0
```

---

## Scenario 5: All-Day Event

### Expected Result
- Create all-day event
- Busy block appears as all-day event (not specific time)
- Format preserved in database

### Test Steps

**Step 5a: Create All-Day Event**
```
1. In calendar.google.com, Calendar A
2. Create event:
   - Title: "Time Off"
   - Make it all-day
   - Save
```

**Step 5b: Verify Busy Block Format**
```
1. Check Calendar B for all-day "Busy" event
2. Should NOT show specific time
3. Should span the entire day block
```

**Verification Checklist:**
- [ ] Busy block appears as all-day event in Calendar B
- [ ] No specific time shown (just the date)
- [ ] managed_busy_blocks.event_start is date format (YYYY-MM-DD)
- [ ] managed_busy_blocks.event_end is date format (YYYY-MM-DD)

```sql
-- Verify date format for all-day events
SELECT source_event_id, event_start, event_end, LENGTH(event_start) as start_len
FROM managed_busy_blocks
WHERE source_event_id = '(source event id)';

-- start_len should be 10 (YYYY-MM-DD format), not 20+ (datetime format)
```

---

## Scenario 6: Loop Prevention

### Expected Result
- Busy block is created with `busyguard: 'managed'` marker
- Creating an event in target calendar doesn't create another busy block
- No infinite loop

### Test Steps

**Step 6a: Verify Busy Block Marker**

In Supabase, check a busy block event's properties:

```sql
-- This test is for validation only
-- The event should have extendedProperties.private.busyguard = 'managed'
-- This is set when creating the busy block in GoogleCalendarProvider
SELECT busy_event_id FROM managed_busy_blocks
WHERE user_id = '(your user ID)'
LIMIT 1;
```

**Step 6b: Manual Loop Test (Optional)**

If you want to verify loop prevention:

```
1. Manually create an event in Calendar B with busyguard marker
   (This requires direct API call or editing extended properties)
2. Create a new source event in Calendar A
3. Verify sync skips the manually-created event with marker
4. Verify no new busy block is created from the marker event
```

**Verification Checklist:**
- [ ] Sync logs show "filter out events we created"
- [ ] No duplicate busy blocks generated
- [ ] Sync completes without errors or cycles

---

## Scenario 7: Multi-Account Sync (Optional)

Only test if you have 2 separate Google accounts.

### Expected Result
- Events in Account A only create busy blocks in Account A's calendars
- No cross-account busy block creation
- Provider map correctly isolates accounts

### Test Steps

**Step 7a: Connect Second Account**
```
1. Log out of busyguard
2. Log in with different identity (different Google account)
3. Connect second Google account (similar to Scenario 1)
4. Verify it has its own calendar_accounts row
```

**Step 7b: Create Events in Both**
```
1. Create event in Account A Calendar 1
2. Create event in Account B Calendar 1
3. Verify busy blocks appear in correct target calendars only
```

**Verification Checklist:**
- [ ] Account A events create busy blocks only in Account A
- [ ] Account B events create busy blocks only in Account B
- [ ] Provider map correctly routed to separate providers
- [ ] No cross-account busy block creation

---

## Checklist: All Scenarios Passed

After completing all tests, verify this checklist:

- [ ] Scenario 1: Account Connection ✓
- [ ] Scenario 2: Event Creation ✓
- [ ] Scenario 3: Event Update ✓
- [ ] Scenario 4: Event Deletion ✓
- [ ] Scenario 5: All-Day Event ✓
- [ ] Scenario 6: Loop Prevention ✓
- [ ] Scenario 7: Multi-Account (if tested) ✓

---

## Issues Found

(Log any issues discovered during testing below)

```
Issue 1: ...
- Expected: ...
- Actual: ...
- Steps to reproduce: ...

Issue 2: ...
```

---

## Known Limitations (Expected Behavior)

- Webhook latency: up to 30 seconds (Google Cloud limitation)
- Busy block title is always "Busy" (not source event title)
- Timezone handling: Uses event's existing timezone (no user-level normalization)
- All-day events: If source is all-day, busy block is also all-day

---

## Next Steps After Testing

If all tests pass:
1. Update STATE.md with "Phase 4 Option A - COMPLETE" ✓
2. Review CODE_REVIEW_PHASE_3.md for any issues to fix
3. Move to **Phase 4 Option B: Webhook Channel Renewal** (critical for production)

If issues found:
1. Document in "Issues Found" section above
2. Create bug fix commits
3. Re-test affected scenarios
4. Update this guide with findings for future reference

---

## Troubleshooting Tips

### "Calendar not found" error
- Verify calendar exists in Google Calendar UI
- Check that `provider_calendar_id` matches Google's calendar ID
- Some calendars may be hidden - unhide in Google Calendar settings

### Webhook never triggers
- Check `GOOGLE_WEBHOOK_TOKEN` is set and 32+ characters
- Verify webhook URL is correct: `http://localhost:3000/api/webhooks/google`
- Check `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- Verify webhook_channels table has entries
- Try manually accessing /api/webhooks/google (should give 400 or 401, not 404)

### Busy block appears but wrong time
- Check source event time in Google Calendar
- Check managed_busy_blocks.event_start/event_end values
- Verify timezone handling (all-day vs datetime)

### Database shows old busy blocks after deletion
- Refresh Supabase dashboard (browser cache)
- Check if deletion sync is pending (watch logs)
- Manually delete orphaned record if sync failed

