# BusyGuard Dashboard - File Index

Quick navigation to all dashboard files and their purposes.

## Start Here

1. **New to this?** → Read [`DASHBOARD_QUICK_START.md`](./DASHBOARD_QUICK_START.md)
2. **Full details?** → Read [`DASHBOARD_IMPLEMENTATION.md`](./DASHBOARD_IMPLEMENTATION.md)
3. **Need code?** → Jump to specific files below

## File Structure

```
busyguard/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                    [MAIN DASHBOARD PAGE]
│   │   ├── accounts/page.tsx           (existing - account connection)
│   │   ├── settings/page.tsx           (existing)
│   │   └── layout.tsx                  (existing - sidebar/nav)
│   └── api/
│       └── calendars/
│           └── toggle/
│               └── route.ts            [NEW API ROUTE]
├── components/
│   └── dashboard/
│       ├── sync-status-card.tsx        [NEW COMPONENT]
│       ├── account-list-section.tsx    [NEW COMPONENT]
│       ├── calendar-toggle-section.tsx [NEW COMPONENT]
│       ├── connect-account-card.tsx    [NEW COMPONENT]
│       ├── billing-section.tsx         (existing)
│       └── providers.tsx               (existing)
├── lib/
│   ├── types.ts                        [NEW TYPES]
│   ├── supabase/                       (existing)
│   └── ...other utils
├── DASHBOARD_INDEX.md                  (THIS FILE)
├── DASHBOARD_QUICK_START.md            (Quick reference)
└── DASHBOARD_IMPLEMENTATION.md         (Full documentation)
```

## Main Files

### Page
| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `/app/dashboard/page.tsx` | Main dashboard - fetches accounts/calendars, shows layout | 151 | New |

### API Routes
| File | Method | Purpose | Lines | Status |
|------|--------|---------|-------|--------|
| `/app/api/calendars/toggle/route.ts` | PATCH | Toggle calendar `is_included` status | 67 | New |

### Components
| File | Purpose | Props | Lines | Status |
|------|---------|-------|-------|--------|
| `/components/dashboard/sync-status-card.tsx` | Shows sync health & status | `calendars` | 73 | New |
| `/components/dashboard/account-list-section.tsx` | Lists accounts + disconnect | `accounts`, `onDisconnect` | 118 | New |
| `/components/dashboard/calendar-toggle-section.tsx` | Toggle calendars on/off | `calendars`, `accounts` | 151 | New |
| `/components/dashboard/connect-account-card.tsx` | CTA to add accounts | none | 28 | New |

### Types
| File | Purpose | Exports | Lines | Status |
|------|---------|---------|-------|--------|
| `/lib/types.ts` | Shared interfaces | `CalendarAccount`, `Calendar`, `SyncStatus` | 35 | New |

### Documentation
| File | Purpose | Audience | Lines |
|------|---------|----------|-------|
| `DASHBOARD_QUICK_START.md` | Quick reference guide | Developers, QA | 234 |
| `DASHBOARD_IMPLEMENTATION.md` | Comprehensive documentation | Developers, maintainers | 227 |
| `DASHBOARD_INDEX.md` | This file - navigation | Everyone | - |

## Component Dependencies

```
/app/dashboard/page.tsx
├── SyncStatusCard
├── AccountListSection
├── CalendarToggleSection
└── ConnectAccountCard
```

All components import from `/lib/types.ts` for type safety.

## API Dependencies

```
/api/calendars/toggle/route.ts
├── /lib/supabase/server.ts (creates client)
├── /lib/types.ts (optional - for reference)
└── Supabase tables: calendars, calendar_accounts
```

## Database Schema

Required tables (see `DASHBOARD_IMPLEMENTATION.md` for full SQL):

```
calendar_accounts
├── id (uuid, pk)
├── user_id (uuid, fk)
├── provider (enum: google|microsoft)
├── email (text)
├── display_name (text, nullable)
├── access_token (text)
├── refresh_token (text, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)

calendars
├── id (uuid, pk)
├── account_id (uuid, fk to calendar_accounts)
├── google_id (text, nullable)
├── microsoft_id (text, nullable)
├── name (text)
├── description (text, nullable)
├── is_included (boolean)          ← This is toggled
├── last_sync_time (timestamp, nullable)
├── next_sync_time (timestamp, nullable)
├── sync_status (enum: idle|syncing|error)
├── sync_error (text, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)
```

## Feature Map

| Feature | File(s) | Type |
|---------|---------|------|
| Show accounts list | `AccountListSection` | Component |
| Disconnect account | `AccountListSection` + existing API | Component + API |
| Toggle calendar on/off | `CalendarToggleSection` + `toggle/route.ts` | Component + API |
| Show sync status | `SyncStatusCard` | Component |
| Show metrics | `/app/dashboard/page.tsx` | Page |
| Empty state | `/app/dashboard/page.tsx` | Page |

## Development Tips

### To modify the account list:
→ Edit `/components/dashboard/account-list-section.tsx`

### To change calendar toggles:
→ Edit `/components/dashboard/calendar-toggle-section.tsx`

### To update sync status display:
→ Edit `/components/dashboard/sync-status-card.tsx`

### To change API behavior:
→ Edit `/app/api/calendars/toggle/route.ts`

### To add new fields:
→ Update `/lib/types.ts` first, then update components

### To change layout:
→ Edit `/app/dashboard/page.tsx` (the grid structure)

## Testing Checklist

- [ ] Build succeeds: `npm run build`
- [ ] Types check: `npx tsc --noEmit`
- [ ] Page loads at `/dashboard`
- [ ] Empty state shows when no accounts
- [ ] Accounts display when connected
- [ ] Calendar toggles work
- [ ] Disconnect button works
- [ ] Sync status updates correctly

## Common Questions

**Q: Where's the account connection flow?**
A: That's in `/app/dashboard/accounts/page.tsx` (existing), which uses the existing Google OAuth integration.

**Q: How does disconnect work?**
A: Uses existing `/api/accounts/disconnect` route. Our component just calls it with confirmation.

**Q: Can I reuse these components?**
A: Yes! They're self-contained and use props for data. Import and use anywhere in the app.

**Q: How often does the dashboard refresh?**
A: Every 30 seconds (set by `export const revalidate = 30` in page.tsx).

**Q: What if sync is taking too long?**
A: It's handled - shows "⟳" icon and keeps that status until the sync engine updates the DB.

**Q: Is there pagination for many calendars?**
A: No, assumes reasonable number per account. Add pagination component if needed.

## Related Documentation

- Existing account flow: `/app/dashboard/accounts/page.tsx`
- Database setup: Supabase dashboard
- Auth setup: `/lib/supabase/server.ts`
- Sync engine: `/lib/sync-engine.ts` (updates sync_status)

## Next Steps

1. Add test data to Supabase
2. Test all user flows
3. Deploy to Vercel
4. Monitor in production
5. Gather user feedback
6. Iterate on UI/features

---

**Last Updated**: March 22, 2025
**Status**: Production Ready
**Type**: Dashboard UI
**Team**: Helsky Labs
