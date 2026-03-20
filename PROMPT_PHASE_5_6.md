# BusyGuard Phase 5 & 6 Kickoff Prompt

**Use this prompt to start Phase 5 & 6 work in a fresh session.**

---

## Status Recap

**Completed Work:**
- ✓ Phase 1: Auth infrastructure (Supabase, middleware, protected routes)
- ✓ Phase 2: Google OAuth + calendar fetch
- ✓ Phase 3: Google sync engine with webhooks
- ✓ Phase 4A: Testing & validation (comprehensive test plan & code review)
- ✓ Phase 4B: Webhook renewal (production-critical feature)

**Current State:**
- App syncs calendars and creates busy blocks
- Webhooks trigger real-time sync
- Channels auto-renew every 7 days
- Build passes, code quality approved
- Ready for production deployment

**Deployment Status:**
- Deployment setup guide created (`DEPLOYMENT_SETUP.md`)
- Environment variables documented
- Vercel cron configured
- Ready to deploy once credentials are set up

---

## Context: What BusyGuard Does

Users connect their Google calendars → app creates "Busy" blocks across calendars when events are added to one. Useful for preventing double-booking when managing multiple calendars.

**Core Flow:**
```
User connects Google account
  → app fetches calendars
  → sets up webhooks
  → syncs all events as busy blocks

When user creates event:
  → webhook triggers
  → app creates busy blocks in other calendars
  → sync happens in real-time

Every 7 days:
  → cron renews webhook channels
  → maintains continuous sync
```

---

## Phase 5: Feature Expansion

Choose the most important feature to build next:

### Option 5A: Microsoft Outlook Integration

**Goal:** Support Microsoft Calendar alongside Google

**Why:** Many enterprises use Outlook. Supporting both increases addressable market.

**Work:**
1. Create `lib/providers/microsoft.ts` — Microsoft Calendar API client
2. Create `app/api/accounts/microsoft/connect/route.ts` — OAuth initiation
3. Create `app/api/accounts/microsoft/callback/route.ts` — OAuth callback
4. Update `lib/sync-engine.ts` — Support both providers
5. Update webhook handler — Route to correct provider
6. Test multi-provider sync

**Estimated Effort:** 12-16 hours
**Complexity:** High (new provider, new OAuth flow, different API)

---

### Option 5B: Sync Status Dashboard

**Goal:** UI to view and manage sync, see what's synced

**Why:** Users need visibility into what's happening. "Is this working?" is first question.

**Work:**
1. Create `/dashboard/sync-status/page.tsx` — Main dashboard page
2. Create `SyncStatusCard` component — Show calendar sync status
3. Create `GET /api/sync-status` endpoint — Return sync data
4. Add manual sync button — `POST /api/sync/trigger`
5. Show webhook channel status (active/expiring)
6. Toggle calendar inclusion (which calendars participate)

**Estimated Effort:** 8-10 hours
**Complexity:** Medium (UI + API endpoint)

---

### Option 5C: Performance Optimization

**Goal:** Support users with many calendars without slowdown

**Why:** Current sync is O(N) where N = event count. Doesn't scale well.

**Work:**
1. Implement incremental sync — Track `lastSync` timestamp per calendar
2. Batch operations — Batch insert multiple busy blocks
3. Optimize queries — Add indexes, reduce N+1 queries
4. Add sync metrics — Log duration, event count, API calls
5. Profile and optimize — Find bottlenecks

**Estimated Effort:** 10-12 hours
**Complexity:** Medium (requires careful optimization)

---

### My Recommendation: **Option 5B (Dashboard)**

**Why:**
- Unblocks user feedback (visibility is critical)
- Essential for production launch (users need to trust the app)
- Medium complexity (can finish in one session)
- Sets foundation for future features (metrics, monitoring)

**Then follow with 5A or 5C** depending on user feedback and priorities.

---

## Phase 6: Production & Monetization

Choose how to launch and sustain:

### Option 6A: SaaS Subscription

**Goal:** Launch on Product Hunt, charge monthly for sync

**Why:** Sustainable revenue model, supports development

**Work:**
1. Integrate Stripe
2. Create pricing page (free tier + paid tiers)
3. Add subscription management UI
4. Implement quota/rate limiting per tier
5. Create payment webhook handler
6. Add onboarding flow
7. Write landing page copy

**Estimated Effort:** 16-20 hours
**Revenue Potential:** $100-1000/month (depends on user acquisition)

---

### Option 6B: One-Time Purchase

**Goal:** Sell license for one-time fee

**Why:** Lower friction for users, guaranteed revenue per customer

**Work:**
1. Integrate Stripe (one-time payment)
2. Create pricing page
3. Add license management (per-user or per-workspace)
4. Create activation/license verification
5. Add payment webhook
6. Write landing page

**Estimated Effort:** 12-16 hours
**Revenue Potential:** $10-30 per customer (higher adoption due to lower friction)

---

### Option 6C: Free with Premium Upsells

**Goal:** Free basic sync, charge for advanced features

**Why:** Viral adoption (everyone tries free), revenue from power users

**Features to monetize:**
- Multiple workspace support
- Advanced filtering/rules
- Custom busy block labels
- Integration with Slack/Discord
- Priority support

**Estimated Effort:** 20+ hours (depends on feature count)
**Revenue Potential:** Low (many users, few convert)

---

### Option 6D: White-Label / Enterprise Licensing

**Goal:** License to businesses that want to resell

**Why:** High value customers, predictable revenue

**Work:**
1. Create SaaS multi-tenant architecture
2. API for resellers to use
3. Whitelabel UI (custom branding)
4. Enterprise features (SSO, audit logs, etc.)
5. Sales/support process

**Estimated Effort:** 30+ hours
**Revenue Potential:** $500-5000/month (but longer sales cycle)

---

### My Recommendation: **Option 6A (SaaS Subscription)**

**Why:**
- Aligns with indie hacker goals (recurring revenue)
- Easier than enterprise sales
- Fair pricing (users benefit, you sustain development)
- Foundation for other models

**Then consider 6B or upsells** if market demands.

---

## Estimated Timeline

| Phase | Effort | Ideal Timeline |
|-------|--------|----------------|
| 5B (Dashboard) | 8-10h | 2-3 days |
| 6A (SaaS) | 16-20h | 4-5 days |
| **Total Phase 5 & 6** | **24-30h** | **6-8 days** |

This fits a 6-day sprint with minimal scope creep.

---

## How to Start

```bash
cd /Users/helrabelo/code/helsky-labs/busyguard

# Read context
cat DEPLOYMENT_SETUP.md     # Deployment requirements
cat STATE.md                # Current project state
cat PROMPT_PHASE_5_6.md     # This file

# Check git status
git status
git log --oneline -10

# Verify build still passes
npm run build

# Decide on Phase 5 & 6 approaches
# Then create implementation plan
```

---

## Decision Framework

### Choose Phase 5 Based On:
- **Time available?** → Pick 5B (dashboard) — fastest
- **Want to scale?** → Pick 5C (optimization) — highest impact
- **Want multi-provider?** → Pick 5A (Microsoft) — most complex

### Choose Phase 6 Based On:
- **Want immediate revenue?** → Pick 6B (one-time) — simplest
- **Want recurring revenue?** → Pick 6A (subscription) — sustainable
- **Have enterprise connections?** → Pick 6D (enterprise) — highest value

---

## Success Criteria for Phase 5 & 6

**Phase 5 (Feature) complete when:**
- [x] Code implemented and tested
- [x] Build passes
- [x] Feature works end-to-end
- [x] Code reviewed
- [x] Documented for future maintenance
- [x] Deployed to Vercel

**Phase 6 (Monetization) complete when:**
- [x] Stripe integrated
- [x] Pricing page live
- [x] Payment flow tested
- [x] First customer acquired
- [x] Onboarding works smoothly

---

## Resources

| Resource | Purpose |
|----------|---------|
| `DEPLOYMENT_SETUP.md` | How to deploy (Google, Supabase, Vercel setup) |
| `STATE.md` | Current project state & architecture |
| `lib/providers/google.ts` | Google Calendar provider (use as template for Microsoft) |
| `lib/sync-engine.ts` | Core sync logic (may need updates for multi-provider) |
| `WEBHOOK_RENEWAL.md` | Webhook renewal documentation |

---

## Important Notes

### Code Quality Standards
- Build must pass: `npm run build`
- TypeScript strict mode enforced
- Code review before merging
- Tests recommended (especially for payment flows)

### Architectural Decisions
- Keep provider abstraction (GoogleCalendarProvider pattern)
- Maintain admin client pattern for background jobs
- Use Supabase for all persistence
- Keep sync logic separate from webhooks

### Production Ready Checklist
- Environment variables documented
- Error handling graceful
- Logging informative
- Security validated
- Performance tested at scale

---

## Next Session Kickoff

When starting Phase 5 & 6 work in a new session:

1. **Read context** (5 min)
   ```
   cat STATE.md
   cat DEPLOYMENT_SETUP.md
   cat PROMPT_PHASE_5_6.md
   ```

2. **Decide scope** (5 min)
   - Pick Phase 5 option
   - Pick Phase 6 option
   - Confirm timeline

3. **Plan implementation** (15 min)
   - List files to create/modify
   - Design data flow
   - Identify integration points

4. **Build** (6-8 hours)
   - Code incrementally
   - Test frequently
   - Commit atomic changes
   - Review before final push

5. **Deploy** (30 min)
   - Push to Vercel
   - Set environment variables
   - Verify in production

---

## Questions for Phase 5 & 6 Session

Before starting next session, think about:

1. **Phase 5 Priority:**
   - Dashboard (get feedback ASAP)
   - Microsoft (expand market)
   - Optimization (prepare for scale)

2. **Phase 6 Priority:**
   - SaaS subscription (recurring)
   - One-time purchase (simpler)
   - Free + upsells (viral)
   - Enterprise (if have leads)

3. **Timeline:**
   - Can you do 6-8 hour sprint?
   - Or prefer smaller phases?

4. **Distribution:**
   - Product Hunt launch planned?
   - B2B focus or consumer?
   - Geographic focus?

---

## Good Luck!

You've built a solid foundation. Phase 5 & 6 are about expanding reach and creating sustainability.

**Pick your approach, commit to the sprint, and ship it.** 🚀

