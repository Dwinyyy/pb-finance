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

Copy `.env.example` to `.env.local` and set a long random `AUTH_SECRET`.

## Backend

The frontend API boundary lives in `src/services/api.js`. It defaults to the same-project Vercel backend at `/api`.

Implemented endpoints:

- `POST /api/auth/login`
- `POST /api/auth/register`
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

Auth uses PBKDF2 password hashing and signed bearer tokens. For persistent production accounts, set:

```bash
AUTH_SECRET=your-long-random-secret
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

If Upstash is not configured, the auth API falls back to an in-memory store for local/dev testing. That fallback is not durable across server restarts or serverless instances.
