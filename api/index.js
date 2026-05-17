import { getRoutePath, handleOptions, readJson, sendError, sendJson } from '../server/http.js';
import { getSessionUser } from '../server/session.js';
import {
  getBearerToken,
  normalizeEmail,
  publicUser,
  refreshSession,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from '../server/supabase.js';

const sessionPayload = (session) => ({
  expiresIn: session.expires_in,
  provider: 'supabase',
  refreshToken: session.refresh_token,
  token: session.access_token,
  user: publicUser(session.user),
});

const handlers = {
  'POST /auth/login': async (req, res) => {
    try {
      const body = await readJson(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const session = await signInWithPassword({ email, password });

      sendJson(res, 200, sessionPayload(session));
    } catch (error) {
      sendError(res, 500, error.message || 'Unable to sign in.');
    }
  },

  'POST /auth/logout': async (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      sendError(res, 401, 'Authentication required.');
      return;
    }

    try {
      await signOut(token);
      sendJson(res, 200, { ok: true, provider: 'supabase' });
    } catch (error) {
      sendError(res, 500, error.message || 'Unable to sign out.');
    }
  },

  'GET /auth/me': async (req, res) => {
    const user = await getSessionUser(req);

    if (!user) {
      sendError(res, 401, 'Authentication required.');
      return;
    }

    sendJson(res, 200, { provider: 'supabase', user });
  },

  'POST /auth/refresh': async (req, res) => {
    try {
      const body = await readJson(req);
      const refreshToken = String(body.refreshToken || body.refresh_token || '');

      if (!refreshToken) {
        sendError(res, 400, 'Refresh token is required.');
        return;
      }

      const session = await refreshSession(refreshToken);
      sendJson(res, 200, sessionPayload(session));
    } catch (error) {
      sendError(res, 401, error.message || 'Unable to refresh session.');
    }
  },

  'POST /auth/register': async (req, res) => {
    try {
      const body = await readJson(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const role = body.role === 'professional' ? 'professional' : 'client';
      const fullName = String(body.fullName || '').trim();
      const company = String(body.company || '').trim();

      if (!email || !email.includes('@')) {
        sendError(res, 400, 'A valid work email is required.');
        return;
      }

      if (password.length < 8) {
        sendError(res, 400, 'Password must be at least 8 characters.');
        return;
      }

      const session = await signUpWithPassword({
        company,
        email,
        fullName,
        password,
        role,
      });
      const user = session.user || session;

      if (!session.access_token) {
        sendJson(res, 202, {
          message: 'Account created. Check your email to confirm your account before signing in.',
          provider: 'supabase',
          requiresEmailConfirmation: true,
          user: publicUser(user),
        });
        return;
      }

      sendJson(res, 201, sessionPayload(session));
    } catch (error) {
      sendError(res, 500, error.message || 'Unable to create account.');
    }
  },

  'GET /agencies': (_req, res) => sendJson(res, 200, []),
  'GET /client/billing': (_req, res) => sendJson(res, 200, { contracts: [], invoices: [], paymentMethods: [] }),
  'GET /client/interviews': (_req, res) => sendJson(res, 200, []),
  'GET /client/shortlist': (_req, res) => sendJson(res, 200, []),
  'POST /matchmaker/suggestions': async (req, res) => {
    await readJson(req);
    sendJson(res, 200, {
      matches: [],
      message: 'No recommendations are available yet.',
    });
  },
  'GET /talent/earnings': (_req, res) => sendJson(res, 200, {
    availableToWithdraw: 0,
    pendingReview: 0,
    timesheets: [],
    totalEarnedYtd: 0,
  }),
  'GET /talent/me': async (req, res) => {
    const user = await getSessionUser(req);

    if (!user) {
      sendError(res, 401, 'Authentication required.');
      return;
    }

    sendJson(res, 200, user.role === 'professional' ? user : {});
  },
  'GET /talent/opportunities': (_req, res) => sendJson(res, 200, []),
  'GET /talent/profiles': (_req, res) => sendJson(res, 200, []),
};

const allowedMethodsForPath = (routePath) => Object.keys(handlers)
  .map((key) => key.split(' '))
  .filter(([, path]) => path === routePath)
  .map(([method]) => method);

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const routePath = getRoutePath(req);
  const route = handlers[`${req.method} ${routePath}`];

  if (route) {
    await route(req, res);
    return;
  }

  const allowedMethods = allowedMethodsForPath(routePath);

  if (allowedMethods.length) {
    res.setHeader('Allow', allowedMethods.join(', '));
    sendError(res, 405, 'Method not allowed.');
    return;
  }

  sendError(res, 404, 'API route not found.');
}
