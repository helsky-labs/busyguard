# Webhook Renewal Testing Guide

**Duration:** 20-30 minutes
**Prerequisites:**
- BusyGuard dev server running (`npm run dev`)
- Supabase project accessible
- `CRON_SECRET` environment variable set in `.env.local`

---

## Pre-Test Setup

### Step 1: Add CRON_SECRET to .env.local

```bash
# Generate a secure secret
openssl rand -base64 32

# Add to .env.local
CRON_SECRET=your-generated-secret-here
```

### Step 2: Verify Dev Server

```bash
npm run dev
# Should start on http://localhost:3000
```

### Step 3: Start Supabase SQL Editor

Open Supabase Dashboard → SQL Editor (for manual queries)

---

## Test Scenario 1: Endpoint Authorization

### Goal
Verify the renewal endpoint properly validates authorization.

### Test Steps

**Step 1a: Call without authorization**
```bash
curl -X GET http://localhost:3000/api/scheduled/renew-webhooks
```

Expected: `401 Unauthorized`

**Step 1b: Call with invalid token**
```bash
curl -X GET http://localhost:3000/api/scheduled/renew-webhooks \
  -H "Authorization: Bearer invalid-token"
```

Expected: `401 Unauthorized`

**Step 1c: Call with correct token**
```bash
curl -X GET http://localhost:3000/api/scheduled/renew-webhooks \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: `200 OK` with JSON response:
```json
{
  "success": true,
  "message": "Webhook channel renewal completed",
  "checked": 0,
  "renewed": 0,
  "failed": 0
}
```

**Verification Checklist:**
- [ ] No auth → 401
- [ ] Invalid token → 401
- [ ] Correct token → 200

---

## Test Scenario 2: Create Fake Expiring Channel

### Goal
Set up a test channel that will expire soon for renewal testing.

### Test Steps

**Step 2a: Find a calendar ID**

First, you need an existing calendar. Query your calendars:

```sql
-- In Supabase SQL Editor
SELECT id, name, provider_calendar_id, is_included
FROM calendars
WHERE is_included = true
LIMIT 1;
```

Note the calendar `id` — you'll need it below.

**Step 2b: Create fake expiring channel**

```sql
-- Replace 'your-calendar-id' with actual ID from Step 2a
INSERT INTO webhook_channels (
  calendar_id,
  provider,
  channel_id,
  resource_id,
  expiry
) VALUES (
  'your-calendar-id',
  'google',
  'fake-channel-old-test-12345',
  'fake-resource-old-test-67890',
  now() + interval '1 hour'  -- expires in 1 hour
);
```

**Step 2c: Verify insertion**

```sql
SELECT id, calendar_id, channel_id, resource_id, expiry
FROM webhook_channels
WHERE channel_id = 'fake-channel-old-test-12345';
```

Should return one row with `expiry` ~1 hour in the future.

**Verification Checklist:**
- [ ] Found existing calendar ID
- [ ] Inserted fake channel successfully
- [ ] Query returns the channel with correct fields

---

## Test Scenario 3: Trigger Renewal (Without Real Google API)

### Goal
Test renewal logic can find and attempt to renew expiring channels.

### Note
In this scenario, the renewal will attempt to call Google APIs and will fail (because we're using fake channel IDs). That's expected. We're testing that the logic:
1. Finds the expiring channel
2. Attempts renewal
3. Handles the error gracefully

### Test Steps

**Step 3a: Trigger renewal endpoint**

```bash
curl -X GET http://localhost:3000/api/scheduled/renew-webhooks \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Step 3b: Check response**

You should see:
```json
{
  "success": false,
  "error": "Failed to renew webhook channels",
  "details": "..."
}
```

**Expected behavior:**
- Endpoint found the expiring channel
- Attempted to stop old watch (will fail due to fake ID)
- Error was caught and logged
- Endpoint returned 500 (because renewal failed)

**Step 3c: Check server logs**

In the terminal running `npm run dev`, you should see:
```
Renewing webhook channel fake-channel-old-test-12345 for calendar...
Failed to stop old watch fake-channel-old-test-12345: ...
```

**Verification Checklist:**
- [ ] Endpoint returned response (not timeout)
- [ ] Error was logged (not silent failure)
- [ ] Server logs show renewal attempt

---

## Test Scenario 4: Real Google API Renewal (Optional)

**This test requires real Google account credentials in database.**

If you have a real channel in the database (from testing Phase 3):

### Test Steps

**Step 4a: Find real channel**

```sql
SELECT id, calendar_id, channel_id, resource_id, expiry
FROM webhook_channels
WHERE expiry > now()
LIMIT 1;
```

If this returns results, you have real channels. If not, skip this scenario (you'll get it once Phase 3 is tested).

**Step 4b: Manually set expiry to soon**

```sql
UPDATE webhook_channels
SET expiry = now() + interval '1 minute'
WHERE channel_id = 'real-channel-from-phase-3';
```

**Step 4c: Trigger renewal**

```bash
curl -X GET http://localhost:3000/api/scheduled/renew-webhooks \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Step 4d: Check response**

Should return:
```json
{
  "success": true,
  "message": "Webhook channel renewal completed",
  "checked": 1,
  "renewed": 1,
  "failed": 0
}
```

**Step 4e: Verify database was updated**

```sql
SELECT id, channel_id, resource_id, expiry, created_at
FROM webhook_channels
WHERE id = 'your-channel-id'
ORDER BY created_at DESC;
```

Should show:
- `channel_id` — NEW value (different from old)
- `resource_id` — NEW value (different from old)
- `expiry` — ~7 days in future (not 1 minute anymore)

**Step 4f: Test event to verify webhook still works**

1. Go to Google Calendar
2. Create a test event
3. Check `/api/webhooks/google` was called
4. Verify busy block appears in target calendar

**Verification Checklist:**
- [ ] Renewal returned success
- [ ] Database shows new channel_id
- [ ] Database shows new resource_id
- [ ] Database shows new expiry (~7 days out)
- [ ] Webhook still triggers for new events

---

## Test Scenario 5: Cron Schedule (Local Testing)

### Goal
Verify cron schedule configuration works with Vercel (requires deployment).

### For Local Development
The cron schedule in `vercel.json` only works when deployed to Vercel. For local testing, use manual curl commands (Scenario 3).

### For Production (After Deployment)

Once deployed to Vercel:
1. Wait for scheduled time (check `vercel.json` schedule)
2. Check Vercel Function logs for the cron run
3. Verify webhook channels in Supabase were renewed

---

## Troubleshooting

### "Authorization: Bearer not recognized"

Make sure environment variable is loaded:
```bash
echo $CRON_SECRET
# Should print your secret

# If empty, add to .env.local and restart dev server
```

### "Failed to renew webhook channels"

Possible causes:
1. Using fake channel ID — this is expected and normal
2. Real Google API error — check Supabase logs
3. Database update failed — very unlikely

Debugging:
```bash
# Check server logs for detailed error
# In terminal running npm run dev, look for:
# "Failed to stop old watch" or "Failed to set up new watch"
```

### Channel not found in renewal

Run this query:
```sql
SELECT COUNT(*) FROM webhook_channels
WHERE expiry < now() + interval '24 hours';
```

If returns 0, no channels are expiring soon. To test:
```sql
UPDATE webhook_channels
SET expiry = now() + interval '1 hour'
LIMIT 1;
```

Then trigger renewal again.

---

## Success Criteria for Phase 4B

- [x] `lib/webhook-renewal.ts` implemented and builds
- [x] `app/api/scheduled/renew-webhooks/route.ts` implemented and builds
- [x] Authorization working (401 on invalid token, 200 on valid)
- [x] Endpoint logs renewal attempts
- [ ] Manual test with fake channel completes (even if fails)
- [ ] Real channel renewal works (optional but recommended)
- [ ] Cron schedule deployed to Vercel (for production)

---

## Next Steps

After testing:

1. **If all tests pass:**
   - Commit changes
   - Deploy to Vercel
   - Set up monitoring for cron job
   - Optionally run Phase 4A tests

2. **If tests fail:**
   - Check error logs
   - Review WEBHOOK_RENEWAL.md for troubleshooting
   - Fix issues and re-test

