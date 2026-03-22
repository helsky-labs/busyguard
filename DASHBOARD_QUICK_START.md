# BusyGuard Dashboard - Quick Start

## Files to Know

### Core Dashboard
- **Page**: `/app/dashboard/page.tsx` - Main dashboard (async server component)
- **Layout**: `/app/dashboard/layout.tsx` - Already exists, has sidebar & nav

### Components (All in `/components/dashboard/`)
- `sync-status-card.tsx` - Shows sync health
- `account-list-section.tsx` - Lists accounts + disconnect
- `calendar-toggle-section.tsx` - Toggle calendars on/off
- `connect-account-card.tsx` - CTA to add accounts

### API Route
- `/app/api/calendars/toggle/route.ts` - PATCH to update calendar `is_included`

### Types
- `/lib/types.ts` - CalendarAccount, Calendar, SyncStatus interfaces

## How to Use

### View Dashboard
```
1. Log in at /auth/login
2. Visit /dashboard
3. See all accounts and calendars
```

### Connect Account
```
1. Click "Connect Account" button
2. Routes to /dashboard/accounts (already implemented)
3. Choose Google or Outlook
4. OAuth flow
5. Returns to /dashboard with success
```

### Toggle Calendar
```
1. On dashboard, find calendar in list
2. Click checkbox to enable/disable
3. API call sent automatically
4. Page reloads to show new state
```

### Disconnect Account
```
1. On dashboard, click "Disconnect" button
2. Confirm in dialog
3. Account and calendars deleted
4. Page reloads
```

## Data Structure

### CalendarAccount
```typescript
{
  id: string              // uuid
  user_id: string        // who owns it
  provider: 'google'     // google | microsoft
  email: string          // user@example.com
  display_name: string   // John Doe
  created_at: string     // ISO timestamp
  updated_at: string     // ISO timestamp
}
```

### Calendar
```typescript
{
  id: string                    // uuid
  account_id: string            // which account owns it
  name: string                  // "Work Calendar"
  is_included: boolean          // sync enabled?
  sync_status: 'idle'           // idle | syncing | error
  last_sync_time: string | null // when was it last synced
  sync_error: string | null     // error message if status=error
}
```

## Key Endpoints

### GET /dashboard
- Lists accounts and calendars
- Shows sync status
- Server-side rendered
- Revalidates every 30 seconds

### PATCH /api/calendars/toggle
Request:
```json
{
  "calendarId": "uuid",
  "is_included": true
}
```

Response:
```json
{
  "success": true,
  "is_included": true
}
```

### POST /api/accounts/disconnect (existing)
Request:
```json
{
  "accountId": "uuid"
}
```

Response:
```json
{
  "success": true
}
```

## UI Layout

```
Dashboard Page
├─ Header (Dashboard title)
├─ Metrics Row (3 cards)
│  ├─ Connected Accounts count
│  ├─ Calendars count
│  └─ Sync Status color-coded
├─ Main Content (2 columns on desktop, 1 on mobile)
│  ├─ Left Column (2/3 width)
│  │  ├─ Account List
│  │  └─ Calendar Toggles
│  └─ Right Column (1/3 width)
│     ├─ Sync Status Card (detailed)
│     ├─ Connect Account CTA
│     └─ How It Works box
└─ Empty State (if no accounts)
   └─ Big CTA to connect first account
```

## Colors & Status

### Sync Status Colors
- **Green** (`bg-green-50`) - All syncing normally
- **Yellow** (`bg-yellow-50`) - Currently syncing
- **Red** (`bg-red-50`) - Has errors

### UI Colors
- **Blue** - Action buttons (connect, toggle)
- **Red** - Danger actions (disconnect)
- **Gray** - Neutral text and backgrounds
- **Green** - Success states

## Debugging

### "Calendar not found" error
- Check calendar exists in Supabase
- Verify user_id matches (auth)
- Check account_id is correct

### Toggle not working
- Check browser console for errors
- Verify API route at `/api/calendars/toggle`
- Check Supabase connection strings

### Empty dashboard
- Check if user has any accounts
- Verify calendar_accounts table populated
- Check user_id filters

## Performance Tips

- Dashboard revalidates every 30 seconds
- Parallel fetch of accounts + calendars
- No client-side state management
- Minimal bundle size (no Redux/Zustand)

## Testing in Development

```bash
npm run dev
# Visit http://localhost:3000/dashboard
```

### Add test data manually in Supabase:
```sql
-- Insert test account
INSERT INTO calendar_accounts (user_id, provider, email, display_name, access_token)
VALUES ('YOUR_USER_ID', 'google', 'test@gmail.com', 'Test Account', 'token');

-- Insert test calendars
INSERT INTO calendars (account_id, name, is_included, sync_status)
VALUES
  ('ACCOUNT_ID', 'Work Calendar', true, 'idle'),
  ('ACCOUNT_ID', 'Personal Calendar', false, 'idle');
```

## Next Steps

1. Test with real Supabase data
2. Verify calendar sync engine updates sync_status/last_sync_time
3. Test error scenarios (toggle with API down)
4. Add analytics tracking if needed
5. Deploy to Vercel

## Common Issues

| Issue | Solution |
|-------|----------|
| Types not found | Check `/lib/types.ts` exports |
| API 404 | Verify `/api/calendars/toggle/route.ts` exists |
| No calendars showing | Check calendar_accounts table has records |
| Toggle doesn't work | Check browser console for fetch errors |
| Page not found | Ensure `/app/dashboard/page.tsx` is there |

---

Ready to use! Questions? Check the files directly - they're well-commented.
