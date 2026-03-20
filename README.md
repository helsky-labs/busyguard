# SaaS Template

Helsky Labs starter template for SaaS applications with auth, billing, and dashboard.

## Quick Start

```bash
cp -r ../helsky-labs/templates/next-saas ./my-saas
cd my-saas
npm install
cp .env.example .env.local
npm run dev
```

## What's Included

- **Auth**: Supabase Auth with email/password and Google OAuth
- **Billing**: Stripe integration (checkout, portal, webhooks)
- **Dashboard**: Protected routes with sidebar layout
- **Analytics**: PostHog integration
- **Email**: Resend ready (add your templates)

## Setup Checklist

### 1. Supabase
- Create project at supabase.com
- Copy URL and keys to `.env.local`
- Enable Google OAuth in Auth settings (optional)

### 2. Stripe
- Create account at stripe.com
- Copy API keys to `.env.local`
- Create products/prices in Stripe dashboard
- Set up webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
- Add price IDs to `.env.local`

### 3. PostHog
- Create project at posthog.com
- Copy project key to `.env.local`

### 4. Database Schema
Create a `users` table in Supabase to store Stripe customer IDs:

```sql
create table users (
  id uuid references auth.users primary key,
  email text,
  stripe_customer_id text,
  subscription_status text,
  created_at timestamp with time zone default now()
);

-- Trigger to create user record on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

## Project Structure

```
app/
├── page.tsx              # Landing page
├── auth/
│   ├── login/           # Login page
│   ├── signup/          # Signup page
│   └── callback/        # OAuth callback
├── dashboard/
│   ├── layout.tsx       # Dashboard layout with sidebar
│   ├── page.tsx         # Main dashboard
│   └── settings/        # Settings + billing
└── api/
    ├── stripe/
    │   ├── checkout/    # Create checkout session
    │   └── portal/      # Open billing portal
    └── webhooks/
        └── stripe/      # Handle Stripe events

lib/
├── supabase/
│   ├── client.ts        # Browser client
│   ├── server.ts        # Server client
│   └── middleware.ts    # Auth middleware
├── stripe.ts            # Stripe helpers
└── posthog.ts           # Analytics
```

## Customization

1. Update branding in `app/layout.tsx` and `app/page.tsx`
2. Add your pricing in `app/page.tsx`
3. Create Stripe products matching your pricing
4. Extend dashboard with your app's features
5. Add email templates for transactional emails
