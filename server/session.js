import { getBearerToken, getSupabaseUser, publicUser, supabaseRestRequest } from './supabase.js';
import { normalizeSessionSummary } from '../src/utils/sessionSummary.js';

const asList = (value) => (Array.isArray(value) ? value : []);
export const toActiveSessionSummary = (user) => normalizeSessionSummary(user);
const normalizeClientTier = (value) => {
  const tier = String(value || '').trim().toLowerCase();

  return ['basic', 'verified', 'vip'].includes(tier) ? tier : 'basic';
};
const PROFESSIONAL_TIER_PERMISSIONS = {
  unverified: {
    canAccessDashboard: false,
    canAppearInTalentPool: false,
    canCommentOnJobPosts: false,
    canContactClientsFromJobs: false,
    canToggleProfileVisibility: false,
    canViewFullClientProfiles: false,
    label: 'Unverified',
  },
  verified: {
    canAccessDashboard: true,
    canAppearInTalentPool: true,
    canCommentOnJobPosts: true,
    canContactClientsFromJobs: true,
    canToggleProfileVisibility: true,
    canViewFullClientProfiles: true,
    label: 'Verified',
  },
};
const normalizeProfessionalTier = (value) => {
  const tier = String(value || '').trim().toLowerCase();

  return ['unverified', 'verified'].includes(tier) ? tier : 'unverified';
};
const getProfessionalTierFromProfile = (profile) => (
  profile?.professional_tier === 'verified'
    && profile?.status === 'approved'
    && profile?.identity_verification_status === 'approved'
    ? 'verified'
    : 'unverified'
);
const withProfessionalPermissions = (user, profile) => {
  if (!user || user.role !== 'professional') {
    return user;
  }

  const tier = profile
    ? getProfessionalTierFromProfile(profile)
    : normalizeProfessionalTier(user.professionalTier || user.professional_tier);
  const permissions = PROFESSIONAL_TIER_PERMISSIONS[tier] || PROFESSIONAL_TIER_PERMISSIONS.unverified;

  return {
    ...user,
    professionalPermissions: {
      ...permissions,
      tier,
    },
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
    return withProfessionalPermissions(user);
  }

  const profileUser = {
    ...user,
    avatarUrl: profile.avatar_url || user.avatarUrl,
    avatar_url: profile.avatar_url || user.avatar_url,
    company: profile.company || user.company,
    email: profile.email || user.email,
    name: profile.full_name || user.name,
    role: profile.role || user.role,
    clientTier: normalizeClientTier(profile.client_tier),
    client_tier: normalizeClientTier(profile.client_tier),
    title: profile.title || user.title,
  };

  if (profileUser.role !== 'professional') {
    return profileUser;
  }

  const professionalRows = await supabaseRestRequest(
    `/professional_profiles?user_id=eq.${profileUser.id}&select=professional_tier,status,profile_visibility,identity_verification_status&limit=1`,
    {
      token,
      useServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    }
  );

  return withProfessionalPermissions(profileUser, asList(professionalRows)[0]);
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
      return withProfessionalPermissions(sessionUser);
    }
  } catch {
    return null;
  }
};
