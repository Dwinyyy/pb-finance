import { handleOptions, requireMethod, sendError, sendJson } from '../_lib/http.js';
import { getSessionUser } from '../_lib/session.js';

export default async function handler(req, res) {
  if (handleOptions(req, res) || !requireMethod(req, res, ['GET'])) return;

  const user = await getSessionUser(req);

  if (!user) {
    sendError(res, 401, 'Authentication required.');
    return;
  }

  sendJson(res, 200, user.role === 'professional' ? user : {});
}
