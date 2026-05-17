import { createToken, normalizeEmail, publicUser, verifyPassword } from '../_lib/auth.js';
import { handleOptions, readJson, requireMethod, sendError, sendJson } from '../_lib/http.js';
import { getStoreMode, getUserByEmail } from '../_lib/store.js';

export default async function handler(req, res) {
  if (handleOptions(req, res) || !requireMethod(req, res, ['POST'])) return;

  try {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const user = await getUserByEmail(email);

    if (!user || !verifyPassword(password, user)) {
      sendError(res, 401, 'Invalid email or password.');
      return;
    }

    sendJson(res, 200, {
      storeMode: getStoreMode(),
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Unable to sign in.');
  }
}
