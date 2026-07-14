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
- `GET /api/notifications/push-config`
- `POST /api/notifications/push-subscription`
- `DELETE /api/notifications/push-subscription`
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
- `POST /api/talent/identity-uploads`
- `POST /api/talent/document-request`
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
- `GET /api/admin/check-expirations`
- `POST /api/admin/check-expirations`

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
NOTIFICATION_EMAILS_DISABLED=false
ADMIN_NOTIFICATION_EMAIL=your-admin@email.com
WEB_PUSH_VAPID_PUBLIC_KEY=your-public-vapid-key
WEB_PUSH_VAPID_PRIVATE_KEY=your-private-vapid-key
WEB_PUSH_SUBJECT=mailto:security@your-production-domain.com
CRON_SECRET=generate-a-long-random-secret
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
Configured workflow emails send by default. Set `NOTIFICATION_EMAILS_DISABLED=true` only when you intentionally need to pause them; any other value leaves delivery enabled.

Browser push notifications use the standard Web Push protocol and are opt-in per browser. Generate one VAPID key pair and reuse it across deployments:

```bash
npx web-push generate-vapid-keys
```

Store the private key only in Vercel server environment variables. The public key is returned to authenticated users by `/api/notifications/push-config`. Subscriptions are stored in `public.push_subscriptions`, which has RLS enabled, no direct `anon` or `authenticated` grants, and explicit `service_role` access only. Apply `supabase/migrations/20260714162000_professional_verification_hardening.sql` (or the current `supabase/schema.sql`) before enabling push in production.

## Professional Verification Operations

Professional onboarding is a mandatory post-account Verification Center. The main Professional dashboard stays locked until a PB Finance admin approves identity evidence, resume, required regulated inputs, and every separate certification required by the selected professional titles.

- Valid ID front and liveness selfie are required. The ID front requires a future expiration date; ID back uses an expiration date when uploaded.
- PRC licenses, BOA accreditations, tax certifications, and other title-mapped certifications remain distinct required slots. The server derives SHA-256 from each upload, then re-reads and hashes the private Storage bytes again at submission before rejecting identical evidence reused across required certification slots.
- Approved identity, resume, and certification evidence is locked. The professional must use Request Change/Removal and give a reason; PB Finance admins see the reason in Talent Review and decide whether to reopen the evidence.
- Profile Settings remains a modal for Bio, Rates, Skills, and profile photo. The professional can preview the published profile with View Profile As Basic Client or Verified Client.
- `vercel.json` runs `/api/admin/check-expirations` daily at `08:00 UTC`. Vercel authenticates the request with `Authorization: Bearer $CRON_SECRET`; manual admin calls remain supported.
- Reminder recovery uses urgency bands: 31-60 days (`reminder_60`), 8-30 days (`reminder_30`), and 1-7 days (`reminder_7`). A missed exact day is recovered on the next run. Expired approved evidence immediately downgrades the professional to unverified/Basic and hides the profile pending renewal and admin approval.
- In-app, configured Brevo email, and opted-in browser push notifications are best effort after compliance state is committed.

The expiration event key is professional + document + reminder band + expiration date, preventing duplicate sends when Vercel retries a daily cron invocation.

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
