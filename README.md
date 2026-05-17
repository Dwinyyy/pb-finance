# PB Finance

React/Vite frontend for the PB Finance public site, client portal, and talent portal.

## Local Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set:

```bash
VITE_API_BASE_URL=https://your-api-host.com
```

If `VITE_API_BASE_URL` is not set, portal data surfaces render production-safe empty states instead of mock records.

## Backend Handoff

The frontend API boundary lives in `src/services/api.js`. Dynamic views now call that wrapper through `src/hooks/useBackendResource.js`.

Initial endpoints expected by the UI:

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`
- `GET /talent/profiles`
- `GET /talent/me`
- `GET /talent/opportunities`
- `GET /talent/earnings`
- `GET /agencies`
- `GET /client/shortlist`
- `GET /client/interviews`
- `GET /client/billing`
- `POST /matchmaker/suggestions`

Authentication tokens should be stored under `pb_auth_token` until the auth flow is fully replaced.
