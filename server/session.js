import { getBearerToken, getSupabaseUser, publicUser, supabaseRestRequest } from './supabase.js';
import {
  getProfessionalTierFromProfile,
  loadProfessionalTierPermissions,
  mapProfessionalTierPermissions,
  normalizeProfessionalTier,
} from './professionalPermissions.js';
import { normalizeSessionSummary } from '../src/utils/sessionSummary.js';

const asList = (value) => (Array.isArray(value) ? value : []);
const CANONICAL_ROLES = new Set(['admin', 'client', 'professional']);
export const toActiveSessionSummary = (user) => normalizeSessionSummary(user);
const normalizeClientTier = (value) => {
  const tier = String(value || '').trim().toLowerCase();

  return ['basic', 'verified', 'vip'].includes(tier) ? tier : 'basic';
};
const withoutCanonicalRole = (user) => ({
  ...user,
  role: null,
});
const withProfessionalPermissions = (user, profile, permissionRow) => {
  if (!user || user.role !== 'professional') {
    return user;
  }

  const tier = profile
    ? getProfessionalTierFromProfile(profile)
    : normalizeProfessionalTier(user.professionalTier || user.professional_tier);
  const permissions = mapProfessionalTierPermissions(
    tier,
    permissionRow || (!profile ? user.professionalPermissions : null)
  );

  return {
    ...user,
    professionalPermissions: permissions,
    professionalTier: tier,
    professionalTierLabel: permissions.label,
    professional_tier: tier,
    profileVisibility: profile?.profile_visibility || user.profileVisibility || user.profile_visibility || 'hidden',
    profile_visibility: profile?.profile_visibility || user.profileVisibility || user.profile_visibility || 'hidden',
  };
};

const getProfileUser = async (req, user) => {
  const token = getBearerToken(req);
  const rows = await supabaseRestRequest(
    `/profiles?id=eq.${user.id}&select=id,avatar_url,email,full_name,company,role,title,client_tier&limit=1`,
    {
      token,
      useServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    }
  );
  const profile = asList(rows)[0];

  if (!profile) {
    return withoutCanonicalRole(user);
  }

  const canonicalRole = CANONICAL_ROLES.has(profile.role) ? profile.role : null;

  const profileUser = {
    ...user,
    avatarUrl: profile.avatar_url || user.avatarUrl,
    avatar_url: profile.avatar_url || user.avatar_url,
    company: profile.company || user.company,
    email: profile.email || user.email,
    name: profile.full_name || user.name,
    role: canonicalRole,
    clientTier: normalizeClientTier(profile.client_tier),
    client_tier: normalizeClientTier(profile.client_tier),
    title: profile.title || user.title,
  };

  if (profileUser.role !== 'professional') {
    return profileUser;
  }

  let professionalProfile = null;

  try {
    const professionalRows = await supabaseRestRequest(
      `/professional_profiles?user_id=eq.${profileUser.id}&select=professional_tier,status,profile_visibility,identity_verification_status&limit=1`,
      {
        token,
        useServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      }
    );
    professionalProfile = asList(professionalRows)[0] || null;
  } catch {
    return withProfessionalPermissions(
      profileUser,
      null,
      mapProfessionalTierPermissions('unverified', null)
    );
  }

  const tier = getProfessionalTierFromProfile(professionalProfile);
  const permissions = await loadProfessionalTierPermissions(
    tier,
    (path) => supabaseRestRequest(path, {
      token,
      useServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    })
  );

  return withProfessionalPermissions(profileUser, professionalProfile, permissions);
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
      return withoutCanonicalRole(sessionUser);
    }
  } catch {
    return null;
  }
};
