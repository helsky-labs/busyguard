# BusyGuard Deployment Setup Guide

**Status:** Phase 4 Complete — Ready for Production Deployment
**Goal:** Configure all credentials and services needed for BusyGuard to work in production

---

## Overview

BusyGuard requires credentials from 5 services:
1. **Google Cloud** — OAuth & Calendar API
2. **Supabase** — Database & Auth
3. **Vercel** — Hosting & Cron jobs
4. **Domain** — Custom domain (optional)
5. **Stripe** (Future) — Payments

---

## Step 1: Google Cloud Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project named "BusyGuard"
3. Note the **Project ID** (you'll need it later)

### 1.2 Enable Google Calendar API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click **Enable**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth 2.0 Client ID**
6. Choose **Web application**
7. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/accounts/google/callback` (local testing)
   - `https://your-domain.com/api/accounts/google/callback` (production)

### 1.3 Get OAuth Credentials

1. After creating OAuth client, note:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client Secret** → `GOOGLE_CLIENT_SECRET` (keep secret!)

### 1.4 Generate Webhook Token

Generate a random 32+ character token for webhook validation:

```bash
openssl rand -base64 32
```

This becomes → `GOOGLE_WEBHOOK_TOKEN`

---

## Step 2: Supabase Setup

### 2.1 Create Supabase Project

1. Go to [Supabase](https://supabase.com/)
2. Sign in or create account
3. Create new project named "BusyGuard"
4. Note the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
5. Go to **Settings** → **API** and note:
   - **Public API key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### 2.2 Run Database Migration

1. Go to Supabase **SQL Editor**
2. Create new query and paste contents of `supabase/migrations/001_initial_schema.sql`
3. Run the query (creates all tables)

### 2.3 Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider (for user signup)
3. Configure email templates if needed

---

## Step 3: Environment Variables

### 3.1 Local Development (.env.local)

Create `.env.local` in project root:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-from-step-1.3
GOOGLE_CLIENT_SECRET=your-client-secret-from-step-1.3
GOOGLE_REDIRECT_URI=http://localhost:3000/api/accounts/google/callback
GOOGLE_WEBHOOK_TOKEN=your-random-token-from-step-1.4

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url-from-step-2.1
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-step-2.1
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-step-2.1

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Scheduled Tasks
CRON_SECRET=another-random-32-char-token-from-step-1.4
```

**IMPORTANT:** Never commit `.env.local` — it contains secrets!

### 3.2 Verify Locally

```bash
npm run dev
# Navigate to http://localhost:3000/dashboard/accounts
# Should load without errors
```

---

## Step 4: Vercel Deployment

### 4.1 Connect GitHub

1. Go to [Vercel](https://vercel.com/)
2. Click **New Project**
3. Import the `helsky-labs` monorepo from GitHub
4. Select `busyguard` as the root directory
5. Click **Deploy**

### 4.2 Add Environment Variables

In Vercel project settings, go to **Settings** → **Environment Variables** and add:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/accounts/google/callback
GOOGLE_WEBHOOK_TOKEN=your-webhook-token
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://your-domain.com
CRON_SECRET=your-cron-secret
```

### 4.3 Update Google OAuth Redirect URI

Go back to Google Cloud Console and add new redirect URI:
```
https://your-vercel-domain.vercel.app/api/accounts/google/callback
```

### 4.4 Configure Custom Domain (Optional)

1. In Vercel, go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS setup instructions
4. Update `NEXT_PUBLIC_APP_URL` and Google redirect URI to custom domain

---

## Step 5: Webhook Configuration

### 5.1 Verify Webhook URL

The webhook URL in production will be:
```
https://your-domain.com/api/webhooks/google
```

This is automatically configured in the app via `NEXT_PUBLIC_APP_URL`.

### 5.2 Test Webhook (After Connecting Calendar)

1. Connect Google account in app
2. Check Supabase `webhook_channels` table
3. Should have rows with `channel_id`, `resource_id`, and `expiry`

---

## Step 6: Cron Job Setup (Webhook Renewal)

### 6.1 Vercel Cron (Automatic)

The app already has `vercel.json` configured to run renewal every 12 hours. No additional setup needed!

To verify:
1. Deploy to Vercel
2. Go to **Settings** → **Cron Jobs**
3. Should show scheduled job

### 6.2 Manual Testing (Before Production)

```bash
curl -X GET https://your-domain.com/api/scheduled/renew-webhooks \
  -H "Authorization: Bearer $CRON_SECRET"
```

Should return:
```json
{
  "success": true,
  "message": "Webhook channel renewal completed",
  "checked": 0,
  "renewed": 0,
  "failed": 0
}
```

---

## Step 7: Verification Checklist

### Pre-Deployment

- [ ] Google Cloud project created
- [ ] Google Calendar API enabled
- [ ] OAuth credentials obtained
- [ ] Webhook token generated
- [ ] Supabase project created
- [ ] Database migration ran successfully
- [ ] Environment variables in `.env.local`
- [ ] Local dev server works (`npm run dev`)
- [ ] Can access `/dashboard/accounts`

### Post-Deployment

- [ ] Vercel deployment successful
- [ ] Environment variables set in Vercel
- [ ] Google redirect URI updated for Vercel domain
- [ ] Custom domain configured (if using)
- [ ] Can access production `/dashboard/accounts`
- [ ] Webhook renewal endpoint accessible and authorized
- [ ] Cron job scheduled in Vercel

### End-to-End Test

- [ ] Navigate to `/dashboard/accounts`
- [ ] Click "Connect Google"
- [ ] Authorize with test account
- [ ] See account listed with calendars
- [ ] Create event in Google Calendar
- [ ] Verify busy block appears in other calendars
- [ ] Check `webhook_channels` table has new entries
- [ ] Check `managed_busy_blocks` table has entries

---

## Troubleshooting

### "Invalid redirect URI"

**Problem:** OAuth fails with redirect URI mismatch

**Solution:**
- Check `GOOGLE_REDIRECT_URI` env var matches Google Cloud Console
- Make sure it includes `/api/accounts/google/callback`

### "Failed to store calendar account"

**Problem:** Can't save account to database

**Solution:**
- Verify Supabase URL is correct
- Verify database migration ran
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct

### "Webhook channel not found"

**Problem:** Webhook doesn't trigger sync

**Solution:**
- Verify webhook_channels table has entries after OAuth
- Check `GOOGLE_WEBHOOK_TOKEN` is correct (must match env var)
- Try creating event in Google Calendar to trigger webhook

### "Cron job not running"

**Problem:** Channels not renewing automatically

**Solution:**
- In Vercel, check **Settings** → **Cron Jobs** exists
- Manually trigger: `curl` command from Step 6.2
- Check Vercel Function logs for errors
- Verify `CRON_SECRET` is set in Vercel env vars

---

## Security Notes

### Secrets to Protect

These should **NEVER** be committed or exposed:
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `GOOGLE_WEBHOOK_TOKEN`

### OAuth Flow

- OAuth code is exchanged server-side (safe)
- Tokens stored in Supabase (encrypted at rest in production)
- Refresh tokens used to keep access fresh
- Never expose tokens to frontend

### Webhook Validation

- Every webhook request validated against `GOOGLE_WEBHOOK_TOKEN`
- Invalid requests return 401 (not processed)
- Prevents fake/malicious webhook triggers

---

## Cost Estimates

| Service | Usage | Estimated Cost |
|---------|-------|-----------------|
| Google Cloud | Calendar API (free tier) | Free |
| Supabase | <100k API calls/month, auth | Free |
| Vercel | Deployment + cron jobs | Free tier ($0 if usage <100h/mo) |
| Domain | Custom domain (optional) | $10-15/year |

**Total:** Free tier covers small-medium usage. Cost increases only if scaling to many users.

---

## Next Steps After Setup

1. **Test Everything Locally** — Follow manual test guide
2. **Deploy to Vercel** — Use this guide's Step 4
3. **Monitor in Production** — Check cron job logs weekly
4. **Plan Phase 5** — Microsoft Graph, Dashboard UI
5. **Plan Phase 6** — Monetization strategy

---

## Support

For issues, check:
1. **WEBHOOK_RENEWAL.md** — Cron & renewal issues
2. **WEBHOOK_RENEWAL_TEST.md** — Testing cron jobs
3. **MANUAL_TEST_GUIDE.md** — Testing full sync flow
4. **Google Cloud Logs** — OAuth & API errors
5. **Supabase Logs** — Database errors
6. **Vercel Logs** — Deployment & cron errors

