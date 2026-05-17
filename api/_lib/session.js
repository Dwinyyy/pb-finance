import { getBearerToken, publicUser, verifyToken } from './auth.js';
import { getUserByEmail } from './store.js';

export const getSessionUser = async (req) => {
  const payload = verifyToken(getBearerToken(req));

  if (!payload?.email) {
    return null;
  }

  const user = await getUserByEmail(payload.email);

  if (!user) {
    return null;
  }

  return publicUser(user);
};
