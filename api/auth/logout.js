import { handleOptions, requireMethod, sendError, sendJson } from '../_lib/http.js';
import { getBearerToken, signOut } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (handleOptions(req, res) || !requireMethod(req, res, ['POST'])) return;

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
}
