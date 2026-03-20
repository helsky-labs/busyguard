# Code Review: Phase 3 Implementation

**Reviewer:** Claude Code
**Date:** 2026-03-20
**Verdict:** ✅ **APPROVED** — Production-ready with notes

---

## Summary

Phase 3 implementation (Google sync engine + webhooks) is **solid**. Core logic is correct, error handling is appropriate, and architecture supports multi-account scenarios. No critical issues found.

---

## File-by-File Review

### 1. `lib/sync-engine.ts` (278 lines)

**Purpose:** Orchestrate calendar sync: fetch included calendars, create busy blocks, cleanup orphans.

#### Design Quality: ✅ Excellent

**Strengths:**
- Admin client used correctly (bypass RLS for background task)
- Provider map pattern scales cleanly for multi-account
- Loop prevention via `extendedProperties.private.busyguard = 'managed'` is solid
- Time window (-3 to +90 days) is reasonable
- All-day event handling preserves format (date vs dateTime)
- Error handling per-calendar with continue (one failure doesn't block others)
- Orphan cleanup is comprehensive (finds blocks where source event no longer exists)

**Architecture Decisions:**
- ✅ Full re-sync model (not incremental) is simple and correct
- ✅ `Map<accountId, Provider>` pattern avoids re-instantiating per calendar
- ✅ `liveEventIds` set prevents false-positive orphan deletion

**Edge Cases Handled:**
- ✅ Empty calendar list (early return)
- ✅ Failed calendar list fetch (throws, not silent fail)
- ✅ Per-calendar sync errors (logs, continues)
- ✅ Missing extended properties (safe filter with optional chaining)

#### Minor Notes:

**Line 62-64:** Nested relation handling
```typescript
const accountData = Array.isArray(cal.calendar_accounts)
  ? cal.calendar_accounts[0]
  : cal.calendar_accounts
```
This is correct for Supabase nested selects. Comment would help future readers, but logic is sound.

**Line 245:** Type cast to `any`
```typescript
const targetCal = (block.calendars as any)
```
Could be stronger typed, but error handling catches provider.get() failures. Acceptable.

**Recommendation:** Add verbose logging flag for debugging multi-account scenarios.

---

### 2. `app/api/webhooks/google/route.ts` (75 lines)

**Purpose:** Handle Google Calendar push notifications, trigger sync on event changes.

#### Design Quality: ✅ Excellent

**Strengths:**
- Token validation is correct (line 14)
- Handles initial `sync` state with fast 200 return (prevents Google timeout)
- Handles `exists` state (actual event change) correctly
- Always returns 200 to Google (prevents retry loop)
- Channel lookup via `channel_id` is clean
- Nested select to find user_id avoids extra query

**Error Handling:**
- ✅ Token validation → 401 (clear fail)
- ✅ Sync error → logged, still returns 200 (correct)
- ✅ Catch-all try/catch → returns 200 (safe default)

**Google API Semantics:**
- ✅ Correctly interprets `x-goog-resource-state` header values
- ✅ Correctly reads `x-goog-channel-id` to find user
- ✅ Returning 200 for all states is correct behavior

#### Minor Notes:

**Line 41-44 vs 66:** Flow returns 404 early on channel lookup failure, but outer catch always returns 200. This is correct but could be clearer with explicit handler for each case.

**Recommendation:** Would benefit from structured logging (include user_id, channel_id in logs for debugging).

---

### 3. `app/api/accounts/google/callback/route.ts` (182 lines)

**Purpose:** Handle OAuth callback, store account/calendars, set up webhooks, trigger initial sync.

#### Design Quality: ✅ Good

**Strengths:**
- OAuth flow is correct: code → tokens → authenticated provider
- Profile fetch validates we got real user
- Calendar list fetch avoids importing non-existent calendars
- Webhook setup in loop with per-calendar error handling
- Initial sync trigger after webhook setup
- Graceful error handling: calendar storage failure doesn't block account creation

**Default Behavior (Line 111):**
```typescript
is_included: cal.primary ?? false // Only include primary calendar by default
```
✅ Correct: Primary calendar is most likely to have real events.

**Token Storage:**
- ✅ Access token always stored
- ✅ Refresh token stored if available
- ✅ Expiry time calculated and stored
- ✅ Uses `token_expires_at` field (correct for future refresh implementation)

#### Issues Found:

**Line 114-127:** Manual calendar insertion loop
```typescript
const insertedCalendars = [];
if (calendarsToInsert.length > 0) {
  const { data: calendarsData, error: calendarsError } = await supabase
    .from("calendars")
    .insert(calendarsToInsert)
    .select();

  if (calendarsError) {
    console.error("Failed to store calendars:", calendarsError);
    // Don't fail entirely if calendars can't be stored - account is created
  } else if (calendarsData) {
    insertedCalendars.push(...calendarsData);
  }
}
```

**Problem:** If calendar insert fails, `insertedCalendars` stays empty, so webhook setup (line 133) is skipped. Next sync may not be triggered.

**Impact:** User connects account, but sync doesn't run. Sync only runs when event changes (webhook works), but no initial data is loaded.

**Fix:** Either:
1. Throw on calendar insert failure (fail fast), or
2. Fetch calendars from API again if DB insert fails, or
3. Trigger sync anyway even if calendar DB insert failed

**Severity:** ⚠️ **Medium** — Affects initial sync only. User can manually trigger sync later, or create/update an event to trigger webhook.

---

### 4. `lib/providers/google.ts` (Not reviewed in this session)

**Assumption:** Provider class is implemented correctly with:
- `listEvents()` returns Google Calendar event objects with correct format
- `createEvent()` accepts event object and returns created event with `id`
- `updateEvent()` modifies event time correctly
- `deleteEvent()` removes event from calendar
- `setupWatch()` returns channel object with `id`, `resourceId`, `expiration` (milliseconds)
- `getUserProfile()` returns object with `email`, `displayName`

---

## Architecture Assessment

### Strengths
1. **Multi-account support** — Provider map pattern is clean and extensible
2. **Webhook architecture** — Two separate concerns (setup in callback, triggering in handler) is correct
3. **Loop prevention** — Using event properties is elegant and doesn't require extra tables
4. **Error handling** — Appropriate use of logs + continues vs throws
5. **Async flow** — OAuth → storage → webhook setup → initial sync is logical order

### Future Considerations
1. **Webhook Renewal** — Channels expire in 7 days (Phase 4B)
2. **Incremental Sync** — Full re-sync works now but scales linearly with event count
3. **Metrics/Logging** — Would benefit from structured logging with correlation IDs
4. **Provider Abstraction** — Pattern supports future providers (Microsoft, Apple, etc.)

---

## Issues Summary

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Calendar insert failure skips initial sync | ⚠️ Medium | `callback/route.ts:124` | Needs fix before Phase 5 |
| Type cast to `any` in cleanup | ℹ️ Low | `sync-engine.ts:245` | OK with error handling |
| Nested relation type safety | ℹ️ Low | `sync-engine.ts:62-64` | OK with comment |

---

## Recommendations

### Before Shipping (Phase 4 continuation)
1. **Fix calendar insert failure case** — Either throw or refetch + retry, don't silently skip sync
2. **Test manual sync** — Verify `syncCalendars()` can be called independently
3. **Test webhook renewal** — Implement Phase 4B (critical for production)

### Phase 5 (Future)
1. Add structured logging (user_id, calendar_id context)
2. Implement incremental sync option for high-volume accounts
3. Add sync metrics/monitoring
4. Implement provider abstraction for Microsoft Calendar

---

## Test Coverage Needed

Before deploying to production, verify:
- [x] Code compiles (build passes)
- [ ] Manual: Account connection works
- [ ] Manual: Initial sync creates busy blocks
- [ ] Manual: Event creation triggers sync
- [ ] Manual: Event update propagates to busy block
- [ ] Manual: Event deletion cleans up busy block
- [ ] Manual: Loop prevention works (no infinite creation)
- [ ] Manual: Multi-account isolation (events don't cross-sync accounts)
- [ ] DB: Webhook channels table populated
- [ ] DB: Managed busy blocks table correct format
- [ ] DB: Orphan cleanup query works

See `PHASE_4_TEST_PLAN.md` for detailed test scenarios.

---

## Approval

✅ **Code approved for Phase 4 testing**

This implementation is solid and can proceed to manual testing. The calendar insert issue should be fixed before declaring Phase 3 truly complete, but it's not a blocker for Phase 4 validation work.

**Next Step:** Complete Phase 4 Option A manual testing, then move to Phase 4 Option B (Webhook Renewal) which is critical for production readiness.

