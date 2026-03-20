# BusyGuard Phase 4 Kickoff Prompt

**Use this prompt to start Phase 4 in a fresh session.**

---

## Context

BusyGuard Phase 3 (Google Sync Engine with webhooks) is complete as of 2026-03-20 (commit `ea71f30`).

- **Phase 1** ✓ — Auth infrastructure (Supabase, middleware, protected routes)
- **Phase 2** ✓ — Google OAuth + calendar fetch (GoogleCalendarProvider, account/calendar storage)
- **Phase 3** ✓ — Google sync engine with webhooks (sync-engine.ts, webhook handler, initial sync)
- **Phase 4** — (Your choice, see below)

## Start Here

Read `/Users/helrabelo/code/helsky-labs/busyguard/STATE.md` to understand the current architecture, what was shipped in Phase 3, and known limitations.

Then choose your Phase 4 work:

---

## Option A: Testing & Validation (Recommended First)

**Goal:** Verify the Phase 3 implementation works end-to-end before adding new features.

**Work:**
1. Set up a test Google account (or use real account cautiously)
2. Run through the full flow:
   - Connect account via `/dashboard/accounts`
   - Verify `webhook_channels` table populated
   - Verify `managed_busy_blocks` rows created
   - Create/update/delete events, watch busy blocks appear/update/delete
3. Verify loop prevention (busy blocks don't create more busy blocks)
4. Test edge cases:
   - All-day events
   - Events across multiple calendars
   - Rapid event updates
5. Document any issues or unexpected behavior
6. Create test cases or automation if needed

**Estimated Effort:** 4-6 hours

**PR Title:** `test: smoke test Phase 3 sync engine end-to-end`

---

## Option B: Webhook Channel Renewal (Critical)

**Goal:** Prevent sync from stopping after 7 days when Google webhook channels expire.

**Current State:**
- Channels are created in `app/api/accounts/google/callback/route.ts`
- Expiry is stored in `webhook_channels.expiry` as timestamptz
- No renewal mechanism exists

**Work:**
1. Create `lib/webhook-renewal.ts` with:
   - `checkAndRenewChannels()` function that:
     - Finds all channels where `expiry < now + 24 hours`
     - Calls `provider.stopWatch()` (graceful cleanup)
     - Calls `provider.setupWatch()` (create new channel)
     - Updates `webhook_channels` with new channel_id, resource_id, expiry
2. Set up cron job or scheduled task:
   - Option A: Vercel Cron (easiest if deploying to Vercel)
   - Option B: External cron service calling `/api/scheduled/renew-webhooks`
   - Option C: Manual for now (operator runs renewal command)
3. Test renewal process:
   - Create old fake channel in DB
   - Trigger renewal
   - Verify old channel stopped, new channel created

**Estimated Effort:** 6-8 hours

**PR Title:** `feat: implement webhook channel renewal before expiry`

**Related Issue:** "Sync stops working after 7 days"

---

## Option C: Microsoft Graph Integration (Large Feature)

**Goal:** Add Microsoft Outlook calendar sync alongside Google.

**Current State:**
- DB schema supports `provider: 'google' | 'microsoft'`
- OAuth flow exists for Google, not Microsoft
- Only GoogleCalendarProvider implemented

**Work:**
1. Create `lib/providers/microsoft.ts`:
   - MicrosoftCalendarProvider class (similar to GoogleCalendarProvider)
   - Implement: `listCalendars()`, `listEvents()`, `createEvent()`, `updateEvent()`, `deleteEvent()`, `setupWatch()`, `stopWatch()`
   - Use Microsoft Graph API (@microsoft/msgraph-sdk or axios)

2. Create `app/api/accounts/microsoft/connect/route.ts`:
   - OAuth initiation with Microsoft scopes
   - Redirect to `/api/accounts/microsoft/callback`

3. Create `app/api/accounts/microsoft/callback/route.ts`:
   - Token exchange, store account
   - List calendars, insert to DB
   - Set up Outlook subscriptions (similar to Google watches)
   - Trigger initial sync

4. Update `lib/sync-engine.ts`:
   - Make provider-agnostic: `buildProvider(provider, account)` that returns Google or Microsoft

5. Update webhook handler:
   - Create separate `app/api/webhooks/microsoft/route.ts` (Microsoft subscription format is different)
   - Or update existing handler to route by provider

6. Test with Microsoft account

**Estimated Effort:** 12-16 hours

**PR Title:** `feat: add Microsoft Outlook calendar sync`

**Complexity:** High (new OAuth flow, new API, new subscription format)

---

## Option D: Sync Status Dashboard

**Goal:** Add UI to view and manage sync status, see busy blocks created.

**Current State:**
- `/dashboard/accounts` shows connected accounts but not sync status
- No visibility into which calendars are synced or busy blocks created

**Work:**
1. Create `/dashboard/sync-status/page.tsx`:
   - List all included calendars
   - Show busy blocks per calendar (count, sample)
   - Show sync last-run timestamp
   - Show webhook channel status (active/expired)

2. Create component `SyncStatusCard`:
   - Display calendar name, event count, busy block count
   - Toggle to include/exclude from sync
   - Show last sync time

3. Create API route `GET /api/sync-status`:
   - Return user's calendars with busy block stats
   - Return webhook channel status

4. Add manual sync button:
   - `POST /api/sync/trigger` endpoint
   - Calls `syncCalendars(userId)` manually
   - Returns status

5. Test UI with real data

**Estimated Effort:** 6-8 hours

**PR Title:** `feat: add sync status dashboard`

---

## Option E: Performance Optimization (Scale)

**Goal:** Optimize sync for users with many calendars.

**Current Limitations:**
- `syncCalendars` does full re-list of all events every time
- No incremental/delta sync
- N² algorithm for busy block creation (source calendars × target calendars)

**Work:**
1. Implement incremental sync:
   - Track last sync timestamp per calendar
   - Use `timeMin` to only fetch changed events
   - Compare with DB to detect deletes

2. Optimize busy block creation:
   - Batch insert multiple blocks
   - Use upsert to simplify create/update logic

3. Add performance metrics:
   - Log sync duration, event count, block count
   - Track API call counts to Google

4. Test with high calendar/event counts

**Estimated Effort:** 8-10 hours

**PR Title:** `perf: implement incremental sync and batch operations`

---

## My Recommendation

**Start with Option A (Testing & Validation)** to:
- Verify nothing is broken
- Build confidence in the implementation
- Identify any immediate issues
- Document the flow for future debugging

**Then move to Option B (Webhook Renewal)** because:
- It's critical for production (sync stops after 7 days without it)
- Medium effort, high impact
- Good next logical step after validation

**Then tackle Option C or D** based on priority:
- Option C if multi-calendar support is important
- Option D if better visibility/control is needed

---

## How to Start

```bash
cd /Users/helrabelo/code/helsky-labs/busyguard

# Read the current state
cat STATE.md

# Check git status
git status

# Verify build still passes
npm run build

# Start dev server if needed
npm run dev

# Then pick your Phase 4 work above and create a new issue/branch
```

---

## Environment Setup Reminder

Ensure `.env.local` has:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/accounts/google/callback
GOOGLE_WEBHOOK_TOKEN=...  # Random string, at least 32 chars
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

For Microsoft (if doing Option C):
```
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/accounts/microsoft/callback
```

---

## Success Criteria

**Pick the option, then:**
1. ✓ Build passes with no errors
2. ✓ Feature works end-to-end (testing + manual verification)
3. ✓ All code reviewed for quality (would a senior engineer approve?)
4. ✓ Commit with clear message describing what was done
5. ✓ Update STATE.md with new phase status

---

**Good luck. Pick your path and ship it.** 🚀
