import { notifyAdmins } from './notifications.js';
import { normalizeEmail, supabaseRestRequest } from './supabase.js';

const DEFAULT_TRIAGE_DOMAINS = [
  'bdo.com',
  'crowe.com',
  'deloitte.com',
  'ey.com',
  'grantthornton.com',
  'kpmg.com',
  'mazars.com',
  'pwc.com',
  'rsmus.com',
];

const asList = (value) => (Array.isArray(value) ? value : []);
const cleanString = (value, maxLength = 500) => String(value || '').trim().slice(0, maxLength);
const hasServiceRoleKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const getEmailDomain = (email) => {
  const normalized = normalizeEmail(email);
  const [, domain = ''] = normalized.split('@');
  return domain;
};

const getTriageDomains = () => {
  const configured = cleanString(process.env.MANUAL_TRIAGE_EMAIL_DOMAINS || process.env.RISKY_PROFESSIONAL_EMAIL_DOMAINS || '', 5000)
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  return [...new Set([...DEFAULT_TRIAGE_DOMAINS, ...configured])];
};

export const shouldTriageProfessionalEmail = (email) => {
  const domain = getEmailDomain(email);

  if (!domain) return false;

  return getTriageDomains().some((blockedDomain) => (
    domain === blockedDomain || domain.endsWith(`.${blockedDomain}`)
  ));
};

export const getAuthProvider = (authUser) => {
  const appProvider = cleanString(authUser?.app_metadata?.provider).toLowerCase();

  if (appProvider) return appProvider;

  const appProviders = asList(authUser?.app_metadata?.providers)
    .map((provider) => cleanString(provider).toLowerCase())
    .filter(Boolean);

  if (appProviders.length) return appProviders[0];

  return asList(authUser?.identities)
    .map((identity) => cleanString(identity?.provider).toLowerCase())
    .filter(Boolean)[0] || '';
};

export const getAuthProviders = (authUser) => {
  const providers = new Set();
  const appProvider = cleanString(authUser?.app_metadata?.provider).toLowerCase();

  if (appProvider) {
    providers.add(appProvider);
  }
  asList(authUser?.app_metadata?.providers)
    .map((provider) => cleanString(provider).toLowerCase())
    .filter(Boolean)
    .forEach((provider) => providers.add(provider));
  asList(authUser?.identities)
    .map((identity) => cleanString(identity?.provider).toLowerCase())
    .filter(Boolean)
    .forEach((provider) => providers.add(provider));

  return [...providers];
};

export const hasAuthProvider = (authUser, provider) => getAuthProviders(authUser).includes(cleanString(provider).toLowerCase());

export const isGoogleAuthUser = (authUser) => getAuthProvider(authUser) === 'google'
  || asList(authUser?.identities).some((identity) => cleanString(identity?.provider).toLowerCase() === 'google');

const dataOptions = (token) => ({
  token,
  useServiceRole: hasServiceRoleKey(),
});

const profilePath = (userId, select = 'id,email,full_name,company,role,title') => (
  `/profiles?id=eq.${encodeURIComponent(userId)}&select=${select}&limit=1`
);

const readProfile = async (userId, token, select) => {
  let rows;

  try {
    rows = await supabaseRestRequest(profilePath(userId, select), dataOptions(token));
  } catch (error) {
    if (!String(error.message || '').includes('google_link_verified_at')) {
      throw error;
    }

    rows = await supabaseRestRequest(profilePath(userId), dataOptions(token));
  }

  return asList(rows)[0] || null;
};

const readProfileWithLinkState = (userId, token) => readProfile(
  userId,
  token,
  'id,email,full_name,company,role,title,google_link_verified_at'
);

const profileName = (authUser) => {
  const metadata = authUser?.user_metadata || {};
  const email = normalizeEmail(authUser?.email);
  return cleanString(metadata.full_name || metadata.name || (email ? email.split('@')[0].replace(/[._-]+/g, ' ') : ''), 180);
};

const ensureClientCompany = async ({ company, email, token, userId }) => {
  const cleanCompany = cleanString(company, 180);

  if (!cleanCompany || !userId) return;

  const existingRows = await supabaseRestRequest(
    `/client_companies?owner_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    dataOptions(token)
  ).catch(() => []);

  if (asList(existingRows)[0]) return;

  await supabaseRestRequest('/client_companies', {
    ...dataOptions(token),
    body: {
      billing_email: normalizeEmail(email),
      name: cleanCompany,
      owner_id: userId,
    },
    method: 'POST',
    prefer: 'return=minimal',
  }).catch(() => undefined);
};

const upsertProfile = async ({ authUser, company, role, token }) => {
  const metadata = authUser?.user_metadata || {};
  const title = role === 'professional' ? 'Complete your profile' : '';
  const cleanCompany = cleanString(company || metadata.company, 180);
  const rows = await supabaseRestRequest('/profiles?on_conflict=id', {
    ...dataOptions(token),
    body: {
      company: cleanCompany,
      email: normalizeEmail(authUser.email),
      full_name: profileName(authUser),
      id: authUser.id,
      role,
      title,
    },
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
  });

  const profile = asList(rows)[0] || null;

  if (role === 'client') {
    await ensureClientCompany({
      company: cleanCompany,
      email: authUser.email,
      token,
      userId: authUser.id,
    });
  }

  return profile;
};

const ensureProfessionalProfile = async ({ token, userId }) => {
  await supabaseRestRequest('/professional_profiles?on_conflict=user_id', {
    ...dataOptions(token),
    body: {
      status: 'draft',
      user_id: userId,
    },
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
  });
};

const ensureRequestedOAuthRole = async ({ authUser, company, requestedRole, token }) => {
  const role = requestedRole === 'professional' || requestedRole === 'client' ? requestedRole : '';
  const cleanCompany = cleanString(company, 180);

  if (!authUser?.id) {
    return null;
  }

  if (!role) {
    return readProfile(authUser.id, token).catch(() => null);
  }

  let profile = await readProfile(authUser.id, token).catch(() => null);

  if (role === 'client' && !cleanCompany && !profile?.company) {
    const error = new Error('Company is required for Google client sign-up.');
    error.status = 400;
    throw error;
  }

  if (!profile) {
    profile = await upsertProfile({ authUser, company: cleanCompany, role, token }).catch(() => null);
  } else if (profile.role !== 'admin' && profile.role !== role) {
    const rows = await supabaseRestRequest(`/profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
      ...dataOptions(token),
      body: {
        ...(role === 'client' && cleanCompany ? { company: cleanCompany } : {}),
        role,
        ...(role === 'professional' ? { title: profile.title || 'Complete your profile' } : {}),
      },
      method: 'PATCH',
      prefer: 'return=representation',
    });
    profile = asList(rows)[0] || profile;
  } else if (role === 'client' && cleanCompany && !profile.company) {
    const rows = await supabaseRestRequest(`/profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
      ...dataOptions(token),
      body: {
        company: cleanCompany,
      },
      method: 'PATCH',
      prefer: 'return=representation',
    });
    profile = asList(rows)[0] || profile;
  }

  if (role === 'professional' && profile?.role !== 'admin') {
    await ensureProfessionalProfile({ token, userId: authUser.id }).catch(() => undefined);
    profile = {
      ...profile,
      role: 'professional',
    };
  }

  if (role === 'client') {
    await ensureClientCompany({
      company: cleanCompany || profile?.company,
      email: authUser.email,
      token,
      userId: authUser.id,
    });
  }

  return profile;
};

const getCompanyRequirement = (profile) => {
  if (profile?.role === 'client' && !cleanString(profile.company, 180)) {
    return {
      email: normalizeEmail(profile.email),
      message: 'Company is required before this Google account can continue.',
      requiresCompany: true,
    };
  }

  return {
    requiresCompany: false,
  };
};

export const flagGoogleProfessionalAccount = async ({
  authUser,
  requestedRole = '',
  sessionUser,
  token,
} = {}) => {
  const email = normalizeEmail(authUser?.email || sessionUser?.email);
  const domain = getEmailDomain(email);
  const effectiveRole = requestedRole === 'professional' || requestedRole === 'client'
    ? requestedRole
    : sessionUser?.role;

  if (sessionUser?.role === 'admin' || !authUser?.id || !isGoogleAuthUser(authUser) || effectiveRole !== 'professional' || !shouldTriageProfessionalEmail(email)) {
    return {
      manualTriageRequired: false,
    };
  }

  let alreadyFlagged = false;

  if (hasServiceRoleKey()) {
    const triageProfile = await readProfile(
      authUser.id,
      token,
      'id,manual_triage_required,manual_triage_status'
    ).catch(() => null);

    alreadyFlagged = Boolean(
      triageProfile?.manual_triage_required
      && triageProfile?.manual_triage_status === 'pending'
    );

    if (!alreadyFlagged) {
      await supabaseRestRequest(`/profiles?id=eq.${encodeURIComponent(authUser.id)}`, {
        ...dataOptions(token),
        body: {
          manual_triage_domain: domain,
          manual_triage_flagged_at: new Date().toISOString(),
          manual_triage_reason: 'Google professional signup from a watched client or CPA-firm domain.',
          manual_triage_required: true,
          manual_triage_source: 'google_oauth',
          manual_triage_status: 'pending',
        },
        method: 'PATCH',
        prefer: 'return=minimal',
      }).catch(() => undefined);

      await supabaseRestRequest(`/professional_profiles?user_id=eq.${encodeURIComponent(authUser.id)}`, {
        ...dataOptions(token),
        body: {
          review_status: 'pending_review',
          status: 'pending_review',
        },
        method: 'PATCH',
        prefer: 'return=minimal',
      }).catch(() => undefined);
    }
  }

  if (!alreadyFlagged) {
    await notifyAdmins({
      actionUrl: '/admin',
      body: `${sessionUser?.name || profileName(authUser) || email} used Google Sign-In as a professional with ${email}. The ${domain} domain is on the manual-triage watchlist.`,
      emailSubject: 'PB Finance account requires manual triage',
      metadata: {
        domain,
        email,
        provider: 'google',
        reason: 'watched_professional_domain',
        userId: authUser.id,
      },
      title: 'Manual account triage required',
      type: 'account_manual_triage',
    });
  }

  return {
    domain,
    manualTriageRequired: true,
    provider: 'google',
  };
};

export const getOAuthAccountLinkRequirement = async ({ authUser, token }) => {
  if (!authUser?.id || !hasAuthProvider(authUser, 'google') || !hasAuthProvider(authUser, 'email')) {
    return {
      requiresAccountLink: false,
    };
  }

  const profile = await readProfileWithLinkState(authUser.id, token).catch(() => null);

  if (profile?.google_link_verified_at) {
    return {
      requiresAccountLink: false,
    };
  }

  return {
    email: normalizeEmail(authUser.email),
    linkMode: 'google_to_password',
    message: `There is already an email/password account for ${normalizeEmail(authUser.email)}. Enter that account password, then verify the email code to link Google Sign-In.`,
    requiresAccountLink: true,
  };
};

export const markGoogleLinkVerified = async ({ token, userId }) => {
  if (!userId) return null;

  let rows;

  try {
    rows = await supabaseRestRequest(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
      ...dataOptions(token),
      body: {
        google_link_verified_at: new Date().toISOString(),
      },
      method: 'PATCH',
      prefer: 'return=representation',
    });
  } catch (error) {
    if (!String(error.message || '').includes('google_link_verified_at')) {
      throw error;
    }

    return null;
  }

  return asList(rows)[0] || null;
};

export const finalizeOAuthAccount = async ({
  authUser,
  company = '',
  linkVerified = false,
  requestedRole = '',
  token,
}) => {
  const linkRequirement = linkVerified
    ? { requiresAccountLink: false }
    : await getOAuthAccountLinkRequirement({ authUser, token });

  if (linkRequirement.requiresAccountLink) {
    return {
      linkRequirement,
      profile: null,
      triage: {
        manualTriageRequired: false,
      },
    };
  }

  const profile = await ensureRequestedOAuthRole({ authUser, company, requestedRole, token });
  const companyRequirement = getCompanyRequirement(profile);

  if (companyRequirement.requiresCompany) {
    return {
      companyRequirement,
      profile: null,
      triage: {
        manualTriageRequired: false,
      },
    };
  }

  const triage = await flagGoogleProfessionalAccount({
    authUser,
    requestedRole,
    sessionUser: profile,
    token,
  });

  return {
    profile,
    triage,
  };
};
