import { getBearerToken, getSupabaseUser, publicUser, supabaseRestRequest } from './supabase.js';

const asList = (value) => (Array.isArray(value) ? value : []);

const getProfileUser = async (req, user) => {
  const token = getBearerToken(req);
  const rows = await supabaseRestRequest(
    `/profiles?id=eq.${user.id}&select=id,email,full_name,company,role,title&limit=1`,
    {
      token,
      useServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    }
  );
  const profile = asList(rows)[0];

  if (!profile) {
    return user;
  }

  return {
    ...user,
    company: profile.company || user.company,
    email: profile.email || user.email,
    name: profile.full_name || user.name,
    role: profile.role || user.role,
    title: profile.title || user.title,
  };
};

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

    const sessionUser = publicUser(user);

    try {
      return await getProfileUser(req, sessionUser);
    } catch {
      return sessionUser;
    }
  } catch {
    return null;
  }
};
