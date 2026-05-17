import { handleOptions, readJson, requireMethod, sendError, sendJson } from '../_lib/http.js';
import { normalizeEmail, publicUser, signUpWithPassword } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (handleOptions(req, res) || !requireMethod(req, res, ['POST'])) return;

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

    sendJson(res, 201, {
      expiresIn: session.expires_in,
      provider: 'supabase',
      refreshToken: session.refresh_token,
      token: session.access_token,
      user: publicUser(user),
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Unable to create account.');
  }
}
