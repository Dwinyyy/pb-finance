import { getBearerToken, getSupabaseUser, publicUser } from './supabase.js';

export const getSessionUser = async (req) => {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  try {
    const user = await getSupabaseUser(token);

    if (!user) {
      return null;
    }

    return publicUser(user);
  } catch {
    return null;
  }
};
