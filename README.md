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

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `GET /api/talent/profiles`
- `GET /api/talent/me`
- `GET /api/talent/opportunities`
- `GET /api/talent/earnings`
- `GET /api/agencies`
- `GET /api/client/shortlist`
- `GET /api/client/interviews`
- `GET /api/client/billing`
- `POST /api/matchmaker/suggestions`

Auth is backed by Supabase Auth. For production, set these in Vercel Project Settings -> Environment Variables and redeploy:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

The backend also accepts `SUPABASE_PUBLISHABLE_KEY` if your Supabase project uses publishable keys instead of the older anon key naming.

User accounts are visible in Supabase Dashboard -> Authentication -> Users. Passwords are managed by Supabase Auth and are not visible as plaintext.

If Supabase email confirmation is enabled, registration returns a confirmation-required response and the user must confirm their email before signing in. For immediate portal access during early testing, disable Confirm email in Supabase Dashboard -> Authentication -> Providers -> Email.

Optional database setup:

```bash
supabase/schema.sql
```

Run that SQL in the Supabase SQL Editor when you want a `profiles` table synced from new auth users.
