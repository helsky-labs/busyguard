# Webhook Channel Renewal

**Status:** Phase 4B Implementation
**Criticality:** CRITICAL — Without renewal, sync stops after 7 days

---

## Problem

Google Calendar push notifications use webhook channels that expire after ~7 days. Without renewal:
- Channels expire but are never refreshed
- New events don't trigger `POST /api/webhooks/google`
- Sync stops working entirely
- User thinks the app is broken

## Solution

Implement automatic renewal before expiry:
1. Check for channels expiring within 24 hours
2. Stop the old watch (graceful cleanup)
3. Set up a new watch (fresh subscription)
4. Update database with new channel info

---

## Implementation

### Files Added

1. **`lib/webhook-renewal.ts`** (121 lines)
   - `checkAndRenewChannels()` — Main renewal logic
   - `renewWebhookChannel()` — Renew individual channel
   - Finds expiring channels, stops old watches, creates new ones

2. **`app/api/scheduled/renew-webhooks/route.ts`** (58 lines)
   - GET endpoint to trigger renewal
   - Requires authorization (Bearer token or Vercel Cron header)
   - Can be called by cron service or manually

### How It Works

```
Channel creation (OAuth callback):
  user connects → setupWatch() → channel stored with expiry

Channel expiry monitoring (scheduled):
  cron job → GET /api/scheduled/renew-webhooks
  → checkAndRenewChannels()
  → finds channels where expiry < now + 24h
  → for each channel:
       ① stopWatch(old_channel_id) - graceful cleanup
       ② setupWatch() - create new channel
       ③ update database with new channel info
```

---

## Configuration

### Environment Variables

Add to `.env.local`:
```bash
CRON_SECRET=your-random-secret-32-chars-minimum
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### Vercel Cron (Recommended for Production)

Create `vercel.json` in project root:

```json
{
  "crons": [
    {
      "path": "/api/scheduled/renew-webhooks",
      "schedule": "0 */12 * * *"
    }
  ]
}
```

This runs renewal every 12 hours (channels expire every ~7 days, so 12 hours is safe).

For local testing without Vercel, set the header manually.

### External Cron Service

If using an external service (e.g., cron-job.org, AWS Lambda):

```bash
curl -X GET https://your-domain.com/api/scheduled/renew-webhooks \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Manual Testing

```bash
# Local development
curl -X GET http://localhost:3000/api/scheduled/renew-webhooks \
  -H "Authorization: Bearer your-cron-secret"

# Production
curl -X GET https://your-domain.com/api/scheduled/renew-webhooks \
  -H "Authorization: Bearer your-cron-secret"
```

---

## Database

### Schema

Table: `webhook_channels`
```
- id (uuid)
- calendar_id (references calendars)
- provider (text) — 'google' or 'microsoft'
- channel_id (text) — Google channel ID
- resource_id (text) — Google resource ID
- expiry (timestamptz) — Expiration timestamp
- created_at (timestamptz)
```

Index on `expiry` makes renewal query fast.

### Renewal Query

```sql
-- Find channels expiring within 24 hours
SELECT * FROM webhook_channels
WHERE expiry < now() + interval '24 hours'
AND provider = 'google';
```

### Post-Renewal

After successful renewal, the row is updated:
- `channel_id` — new value from setupWatch()
- `resource_id` — new value from setupWatch()
- `expiry` — new expiration date (~7 days from now)
- created_at remains unchanged

---

## Testing

### Test Scenario 1: Create Fake Expiring Channel

For testing, manually insert an expiring channel:

```sql
-- In Supabase SQL Editor
INSERT INTO webhook_channels (calendar_id, provider, channel_id, resource_id, expiry)
VALUES (
  'your-calendar-id',
  'google',
  'test-channel-id-old',
  'test-resource-id-old',
  now() + interval '1 hour'  -- expires in 1 hour
);
```

### Test Scenario 2: Trigger Renewal

```bash
curl -X GET http://localhost:3000/api/scheduled/renew-webhooks \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "message": "Webhook channel renewal completed",
  "checked": 1,
  "renewed": 1,
  "failed": 0
}
```

### Test Scenario 3: Verify Database Update

```sql
SELECT id, channel_id, resource_id, expiry
FROM webhook_channels
WHERE id = 'your-test-channel-id'
ORDER BY expiry DESC
LIMIT 1;
```

Should show:
- `channel_id` — new value (different from old)
- `expiry` — ~7 days in future

### Test Scenario 4: Verify Old Watch Stopped

In Google Calendar API logs (or app logs), you should see:
```
✓ Stopped old watch {old_channel_id}
✓ Set up new watch with channel_id {new_channel_id}
✓ Updated webhook_channels record {channel_id}
```

---

## Monitoring

### Logs to Watch

In production, monitor these logs:
```
"Webhook renewal completed: { checked: 5, renewed: 5, failed: 0 }"
"Failed to renew webhook channel {id}: {error}"
```

### Metrics to Track

- `checked` — How many channels were expiring
- `renewed` — How many successfully renewed
- `failed` — How many failed to renew

Good patterns:
- `renewed == checked` (all channels renewed successfully)
- `failed == 0` (no failures)
- `checked > 0` on every cron run (channels exist to renew)

Bad patterns:
- `failed > 0` (some channels failed to renew)
- Errors like "Failed to stop old watch" (Google API issues)

---

## Error Handling

### Google API Errors

If `stopWatch()` fails:
- Error is logged but **not fatal**
- New watch is still set up
- This is safe because old watch will naturally expire

If `setupWatch()` fails:
- Error is thrown
- Channel is NOT updated in database
- Old channel remains active (sync continues)
- Will be retried on next cron run

If database update fails:
- New watch is created but not saved to DB
- **CRITICAL**: Channel won't be found for future renewal
- Webhook requests will fail because channel_id is stale
- **Fix**: Must manually insert new channel_id into database

### Recovery

If renewal fails:
1. Check server logs for error messages
2. Verify Google API credentials are still valid
3. If Google API is down, wait for recovery (cron will retry)
4. If database insert fails, manually update `webhook_channels` with new channel ID

---

## Future Improvements

1. **Microsoft Graph Support**
   - Extend `checkAndRenewChannels()` to handle `provider = 'microsoft'`
   - Microsoft subscriptions expire after 3 days (need shorter interval)

2. **Exponential Backoff**
   - Retry failed renewals with exponential backoff
   - Track retry count in database

3. **Monitoring/Alerting**
   - Send alert if `failed > 0`
   - Send alert if no channels found (unexpected)
   - Track renewal latency

4. **Manual Renewal UI**
   - Allow users to manually trigger renewal from dashboard
   - Show channel status (active, expiring soon, expired)

---

## Deployment

### Vercel

1. Add `CRON_SECRET` to environment variables in Vercel dashboard
2. Add `vercel.json` with cron config
3. Deploy — cron will run automatically

### Self-Hosted

1. Set `CRON_SECRET` environment variable
2. Configure external cron service to call `/api/scheduled/renew-webhooks`
3. Or use node-cron package to run renewal every 12 hours

---

## Success Criteria for Phase 4B

- [x] `lib/webhook-renewal.ts` implemented
- [x] `app/api/scheduled/renew-webhooks/route.ts` implemented
- [x] Build passes with no errors
- [x] Code reviewed for correctness
- [ ] Manual test: Trigger renewal on test channel
- [ ] Verify database updated with new channel info
- [ ] Document for production deployment

