import { handleOptions, readJson, requireMethod, sendError, sendJson } from '../_lib/http.js';
import { publicUser, refreshSession } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (handleOptions(req, res) || !requireMethod(req, res, ['POST'])) return;

  try {
    const body = await readJson(req);
    const refreshToken = String(body.refreshToken || body.refresh_token || '');

    if (!refreshToken) {
      sendError(res, 400, 'Refresh token is required.');
      return;
    }

    const session = await refreshSession(refreshToken);

    sendJson(res, 200, {
      expiresIn: session.expires_in,
      provider: 'supabase',
      refreshToken: session.refresh_token,
      token: session.access_token,
      user: publicUser(session.user),
    });
  } catch (error) {
    sendError(res, 401, error.message || 'Unable to refresh session.');
  }
}
