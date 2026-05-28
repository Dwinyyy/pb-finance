# PB Finance

React/Vite frontend for the PB Finance public site, client portal, and talent portal.

## Local Setup

```bash
npm install
npm run dev
```

For the Vite-only frontend server, use `npm run dev`. For the frontend plus Vercel API functions, use:

```bash
npx vercel dev
```

Copy `.env.example` to `.env.local` and set your Supabase project URL plus an anon or publishable API key.

## Backend

The frontend API boundary lives in `src/services/api.js`. It defaults to the same-project Vercel backend at `/api`.

The API is deployed through one Vercel Serverless Function (`api/index.js`) and Vercel rewrites `/api/*` requests into that router. This keeps the project inside the Hobby plan function limit.

Implemented endpoints:

- `GET /api/health`
- `GET /api/notifications`
- `PATCH /api/notifications`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/register`
- `POST /api/auth/register/verify`
- `POST /api/auth/google`
- `POST /api/auth/oauth/finalize`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/admin/talent`
- `PATCH /api/admin/talent`
- `GET /api/admin/agencies`
- `POST /api/admin/agencies`
- `PATCH /api/admin/agencies`
- `GET /api/talent/profiles`
- `GET /api/talent/me`
- `PATCH /api/talent/me`
- `POST /api/talent/uploads`
- `GET /api/talent/opportunities`
- `PATCH /api/talent/opportunities`
- `GET /api/talent/earnings`
- `GET /api/agencies`
- `GET /api/client/shortlist`
- `POST /api/client/shortlist`
- `DELETE /api/client/shortlist`
- `GET /api/client/interviews`
- `POST /api/client/interviews`
- `GET /api/client/billing`
- `POST /api/matchmaker/suggestions`

Auth is backed by Supabase Auth. For production, set these in Vercel Project Settings -> Environment Variables and redeploy:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REDIS_URL=rediss://default:your-redis-password@your-redis-host:6379
REGISTRATION_JWT_SECRET=generate-at-least-32-random-characters
PUBLIC_APP_URL=https://your-production-domain.com
BREVO_API_KEY=your-brevo-api-key
NOTIFICATION_FROM_EMAIL=your-verified-sender@email.com
NOTIFICATION_FROM_NAME=PB Finance
ADMIN_NOTIFICATION_EMAIL=your-admin@email.com
MANUAL_TRIAGE_EMAIL_DOMAINS=deloitte.com,ey.com,pwc.com,kpmg.com
```

The backend also accepts `SUPABASE_PUBLISHABLE_KEY` if your Supabase project uses publishable keys instead of the older anon key naming.
`SUPABASE_SERVICE_ROLE_KEY` is optional for local testing, but recommended for Vercel API routes so the server can perform controlled reads while still enforcing role checks before responding. Never expose this key to frontend code.

User accounts are visible in Supabase Dashboard -> Authentication -> Users. Passwords are managed by Supabase Auth and are not visible as plaintext.

Set Supabase Dashboard -> Authentication -> URL Configuration -> Site URL to your production URL, such as `https://pb-finance.vercel.app`. Add local and preview domains to Redirect URLs only when you need them.

Email/password registration now starts with a Redis-backed 6-digit verification code. `/api/auth/register` creates a 10-minute encrypted registration JWT, stores the pending payload in Redis, and sends the OTP through Brevo. `/api/auth/register/verify` creates the Supabase Auth user only after the matching OTP is submitted. If Supabase email confirmation is also enabled, the user may still need to complete Supabase's confirmation email after the OTP step.

Google Sign-In is available from login and signup. Professional Google accounts whose email domains match `MANUAL_TRIAGE_EMAIL_DOMAINS` or the built-in CPA watchlist are flagged on `profiles` for manual admin triage and admins are notified.

For production confirmation emails, use Brevo as the free SMTP provider. See `docs/smtp-brevo.md` and `scripts/configure-supabase-brevo-smtp.ps1`.
Runtime workflow emails also support Brevo. If `BREVO_API_KEY` and `NOTIFICATION_FROM_EMAIL` are missing, the app still creates in-app notifications and silently skips email sending.

Optional database setup:

```bash
supabase/schema.sql
```

Run that SQL in the Supabase SQL Editor to create the first production-ready data model: profiles, professional profiles, agencies, client companies, shortlists, opportunities, interviews, contracts, invoices, payment method metadata, timesheets, match requests, and notifications.

To enable the built-in admin console, create a normal user first, then promote that account in Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'you@example.com';
```

Log out and log back in with that account. Admin routes require `SUPABASE_SERVICE_ROLE_KEY` to be set on the server.

## Step 4 Verification

Run a local backend check without printing secret values:

```bash
npm run check:backend
```

For deployed projects, open `/api/health` on your production domain after each redeploy. It should return `ok: true` and `supabaseConnected: true`.

End-to-end smoke test:

1. Create or log in as a professional, then save the professional profile.
2. Log in as admin and approve that professional in Admin Console.
3. Log in as a client and confirm the approved professional appears in Discover.
4. Save the professional to Shortlist and request an interview.
5. Log in as the professional and accept or decline the opportunity.

The current backend is designed for free-plan operation first:

- Vercel serves the frontend and a single `/api` serverless router.
- Supabase stores auth and application data.
- Brevo can handle free transactional email for confirmation and password flows.
- Stripe should be added only when billing is ready; store Stripe IDs and safe card metadata only, never full card details.
- The matchmaker uses local keyword scoring first, avoiding paid AI usage until there is enough real data to justify it.
