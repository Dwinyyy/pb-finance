import { getRoutePath, handleOptions, readJson, sendError, sendJson } from '../server/http.js';
import { notifyAdmins, notifyUser } from '../server/notifications.js';
import { getSessionUser } from '../server/session.js';
import {
  getBearerToken,
  normalizeEmail,
  publicUser,
  refreshSession,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  supabaseRestRequest,
} from '../server/supabase.js';

const hasServiceRoleKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const getDataOptions = (req) => ({
  token: getBearerToken(req),
  useServiceRole: Boolean(req.useServiceRole),
});

const asList = (value) => (Array.isArray(value) ? value : []);
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

const cleanString = (value, maxLength = 500) => String(value || '').trim().slice(0, maxLength);
const placeholderTitles = new Set(['Complete your profile', 'Finance Professional']);
const cleanProfileTitle = (value) => {
  const title = cleanString(value, 160);

  return title && !placeholderTitles.has(title) ? title : '';
};

const cleanList = (value, maxItems = 20) => {
  const list = Array.isArray(value)
    ? value
    : String(value || '').split(',');

  return [...new Set(list
    .map((item) => cleanString(item, 80))
    .filter(Boolean))]
    .slice(0, maxItems);
};
const cleanProfessionalTitles = (value, fallback = []) => {
  const source = value === undefined ? fallback : value;
  const rawTitles = Array.isArray(source)
    ? source
    : String(source || '').split(',');

  return [...new Set(rawTitles
    .map(cleanProfileTitle)
    .filter(Boolean))]
    .slice(0, 8);
};
const formatProfessionalTitles = (titles) => cleanProfessionalTitles(titles).join(', ');

const getProfileUserForSession = async (session) => {
  const user = publicUser(session.user);

  if (!user.id) {
    return user;
  }

  try {
    const rows = await supabaseRestRequest(
      `/profiles?id=eq.${user.id}&select=id,email,full_name,company,role,title&limit=1`,
      {
        token: session.access_token,
        useServiceRole: false,
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
  } catch {
    return user;
  }
};

const sessionPayload = async (session) => ({
  expiresIn: session.expires_in,
  provider: 'supabase',
  refreshToken: session.refresh_token,
  token: session.access_token,
  user: await getProfileUserForSession(session),
});

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getMonthDay = (value) => {
  if (!value) {
    return { day: '--', month: 'TBD', time: 'Time pending' };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { day: '--', month: 'TBD', time: 'Time pending' };
  }

  return {
    day: date.toLocaleDateString('en-US', { day: '2-digit' }),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
};

const requireSession = async (req, res, allowedRoles = []) => {
  const user = await getSessionUser(req);

  if (!user) {
    sendError(res, 401, 'Authentication required.');
    return null;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    sendError(res, 403, 'You do not have access to this resource.');
    return null;
  }

  return user;
};

const requireAdmin = async (req, res) => {
  const user = await requireSession(req, res, ['admin']);

  if (!user) return null;

  if (!hasServiceRoleKey()) {
    sendError(res, 500, 'Admin routes require SUPABASE_SERVICE_ROLE_KEY on the server.');
    return null;
  }

  req.useServiceRole = true;
  return user;
};

const readRows = (req, path) => supabaseRestRequest(path, getDataOptions(req));

const writeRows = (req, path, body, { method = 'POST', prefer = 'return=representation' } = {}) => (
  supabaseRestRequest(path, {
    ...getDataOptions(req),
    body,
    method,
    prefer,
  })
);

const patchRows = (req, path, body, { prefer = 'return=representation' } = {}) => (
  writeRows(req, path, body, { method: 'PATCH', prefer })
);

const byIdFilter = (ids) => `in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`;

const loadProfilesById = async (req, ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  const rows = await readRows(
    req,
    `/profiles?id=${byIdFilter(uniqueIds)}&select=id,email,full_name,company,role,title`
  );

  return new Map(asList(rows).map((profile) => [profile.id, profile]));
};

const hasPendingProfile = (profile) => (
  profile?.pending_profile && Object.keys(profile.pending_profile).length > 0
);

const toProfilePatch = (profile) => ({
  availability: profile.availability,
  bio: profile.bio,
  certifications: cleanList(profile.certifications),
  country: profile.country,
  hourly_rate: toNumber(profile.hourly_rate),
  industries: cleanList(profile.industries),
  location: profile.location,
  skills: cleanList(profile.skills),
  titles: cleanProfessionalTitles(profile.titles ?? profile.title),
  tools: cleanList(profile.tools),
  work_preferences: typeof profile.work_preferences === 'object' && profile.work_preferences !== null
    ? profile.work_preferences
    : {},
  years_experience: toNumber(profile.years_experience),
});

const mapTalentProfile = (profile, owner = {}, { usePending = false } = {}) => {
  const pending = usePending && profile.pending_profile ? profile.pending_profile : {};
  const viewProfile = { ...profile, ...pending };
  const displayName = pending.full_name || owner.full_name || owner.name || 'Unnamed profile';
  const pendingHasTitles = Object.hasOwn(pending, 'titles') || Object.hasOwn(pending, 'title');
  const titles = pendingHasTitles
    ? cleanProfessionalTitles(pending.titles ?? pending.title)
    : cleanProfessionalTitles(viewProfile.titles, cleanProfessionalTitles(owner.title));
  const title = formatProfessionalTitles(titles);
  const hourlyRate = toNumber(viewProfile.hourly_rate);
  const years = toNumber(viewProfile.years_experience);
  const reviewStatus = profile.review_status || (profile.status === 'pending_review' ? 'pending_review' : null);

  return {
    available: viewProfile.availability || 'Immediate Start',
    availability: viewProfile.availability || 'Immediate Start',
    bio: viewProfile.bio || '',
    certifications: asList(viewProfile.certifications),
    email: owner.email || '',
    exp: years ? `${years}+ yrs` : '',
    experience: years ? `${years}+ years` : '',
    fullName: displayName,
    id: profile.user_id,
    hasPendingChanges: hasPendingProfile(profile),
    industries: asList(viewProfile.industries),
    location: viewProfile.location || viewProfile.country || '',
    name: displayName,
    rate: hourlyRate,
    rating: toNumber(viewProfile.rating),
    reviewCount: profile.review_count || 0,
    reviewStatus,
    role: title,
    skills: asList(viewProfile.skills),
    status: usePending ? (reviewStatus || profile.status) : profile.status,
    title,
    titles,
    tools: asList(viewProfile.tools),
    yearsExperience: years,
  };
};

const loadTalentProfiles = async (req, { ids, onlyApproved = false, usePending = false } = {}) => {
  if (ids && ids.length === 0) {
    return [];
  }

  const filters = [];

  if (ids?.length) {
    filters.push(`user_id=${byIdFilter([...new Set(ids)])}`);
  }

  if (onlyApproved) {
    filters.push('status=eq.approved');
  }

  const query = filters.length ? `?${filters.join('&')}&` : '?';
  const rows = await readRows(
    req,
    `/professional_profiles${query}select=*&order=updated_at.desc&limit=100`
  );
  const profileRows = asList(rows);
  const owners = await loadProfilesById(req, profileRows.map((row) => row.user_id));

  return profileRows.map((profile) => mapTalentProfile(profile, owners.get(profile.user_id), { usePending }));
};

const mapAgency = (agency) => ({
  certs: asList(agency.certifications),
  certifications: asList(agency.certifications),
  description: agency.description || '',
  id: agency.id,
  location: agency.location || '',
  monthlyRate: toNumber(agency.monthly_rate),
  name: agency.name || 'Unnamed agency',
  rate: toNumber(agency.monthly_rate),
  rating: toNumber(agency.rating),
  reviewCount: agency.review_count || 0,
  size: agency.team_size || '',
  specialty: agency.specialty || '',
  status: agency.status,
  tools: asList(agency.tools),
});

const tokenize = (value) => String(value || '')
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .filter((word) => word.length > 2);

const scoreMatch = (messageTokens, record, fields) => {
  const haystack = tokenize(fields.map((field) => {
    const value = record[field];
    return Array.isArray(value) ? value.join(' ') : value;
  }).join(' '));
  const haystackSet = new Set(haystack);

  return messageTokens.reduce((score, token) => score + (haystackSet.has(token) ? 1 : 0), 0);
};

const getProfessionalProfile = async (req, professionalId, { requireApproved = false } = {}) => {
  if (!isUuid(professionalId)) {
    return null;
  }

  const filters = [`user_id=eq.${professionalId}`];

  if (requireApproved) {
    filters.push('status=eq.approved');
  }

  const rows = await readRows(
    req,
    `/professional_profiles?${filters.join('&')}&select=*&limit=1`
  );

  return asList(rows)[0] || null;
};

const getPrimaryClientCompanyName = async (req, clientId, fallback = '') => {
  const rows = await readRows(
    req,
    `/client_companies?owner_id=eq.${clientId}&select=name&order=created_at.asc&limit=1`
  );

  return asList(rows)[0]?.name || fallback || 'Client company';
};

const normalizeAvailability = (value) => {
  return value || 'Immediate Start';
};

const talentStatuses = new Set(['draft', 'pending_review', 'approved', 'hidden', 'rejected']);
const agencyStatuses = new Set(['draft', 'pending_review', 'approved', 'hidden', 'rejected']);

const normalizeStatus = (status, allowedStatuses, fallback = 'pending_review') => {
  const value = cleanString(status, 40);
  return allowedStatuses.has(value) ? value : fallback;
};

const formatStatusLabel = (value) => cleanString(value, 80).replace(/_/g, ' ');

const mapNotification = (notification) => ({
  actionUrl: notification.action_url,
  body: notification.body,
  createdAt: notification.created_at,
  id: notification.id,
  isRead: Boolean(notification.read_at),
  metadata: notification.metadata || {},
  readAt: notification.read_at,
  title: notification.title,
  type: notification.type,
});

const opportunityStatusPriority = {
  accepted: 5,
  active: 5,
  invited: 4,
  cancelled: 3,
  declined: 2,
  closed: 1,
};

const interviewStatusPriority = {
  scheduled: 5,
  requesting: 4,
  requested: 4,
  completed: 3,
  cancelled: 2,
  no_show: 1,
};

const setPreferredByStatus = (map, row, priorityMap) => {
  const current = map.get(row.professional_id);
  const currentPriority = current ? priorityMap[current.status] || 0 : -1;
  const nextPriority = priorityMap[row.status] || 0;

  if (!current || nextPriority > currentPriority) {
    map.set(row.professional_id, row);
  }
};

const cancelInterview = async (req, {
  actor,
  allowedRole,
  interviewId,
  opportunityId,
  reason,
}) => {
  const actorColumn = allowedRole === 'client' ? 'client_id' : 'professional_id';
  const filters = [`${actorColumn}=eq.${actor.id}`];

  if (interviewId) {
    filters.push(`id=eq.${interviewId}`);
  }

  if (opportunityId) {
    filters.push(`opportunity_id=eq.${opportunityId}`);
  }

  const rows = await readRows(
    req,
    `/interviews?${filters.join('&')}&status=in.(requesting,requested,scheduled)&select=*&limit=1`
  );
  const interview = asList(rows)[0];

  if (!interview) {
    return null;
  }

  const cancellationReason = cleanString(reason, 1000);
  const cancelledAt = new Date().toISOString();
  const updatedRows = await patchRows(
    req,
    `/interviews?id=eq.${interview.id}&${actorColumn}=eq.${actor.id}`,
    {
      cancellation_reason: cancellationReason,
      cancelled_at: cancelledAt,
      cancelled_by: actor.id,
      status: 'cancelled',
    }
  );
  const updatedInterview = asList(updatedRows)[0] || {
    ...interview,
    cancellation_reason: cancellationReason,
    cancelled_at: cancelledAt,
    cancelled_by: actor.id,
    status: 'cancelled',
  };

  if (interview.opportunity_id) {
    await patchRows(
      req,
      `/opportunities?id=eq.${interview.opportunity_id}`,
      { status: 'cancelled' },
      { prefer: 'return=minimal' }
    ).catch(() => {});
  }

  return updatedInterview;
};

const buildAgencyPayload = (body, fallback = {}) => {
  const monthlyRate = toNumber(body.monthlyRate ?? body.monthly_rate ?? fallback.monthly_rate);
  const ownerId = cleanString(body.ownerId || body.owner_id || fallback.owner_id, 80);
  const reviewCount = Number(body.reviewCount ?? body.review_count ?? fallback.review_count ?? 0);

  return {
    certifications: cleanList(body.certifications ?? fallback.certifications),
    description: cleanString(body.description ?? fallback.description, 1600),
    location: cleanString(body.location ?? fallback.location, 180),
    monthly_rate: monthlyRate,
    name: cleanString(body.name ?? fallback.name, 180),
    owner_id: isUuid(ownerId) ? ownerId : null,
    rating: toNumber(body.rating ?? fallback.rating),
    review_count: Number.isFinite(reviewCount) ? reviewCount : 0,
    slug: cleanString(body.slug ?? fallback.slug, 180) || null,
    specialty: cleanString(body.specialty ?? fallback.specialty, 180),
    status: normalizeStatus(body.status ?? fallback.status, agencyStatuses, 'pending_review'),
    team_size: cleanString(body.teamSize ?? body.team_size ?? fallback.team_size, 80),
    tools: cleanList(body.tools ?? fallback.tools),
  };
};

const handlers = {
  'GET /health': async (req, res) => {
    const checks = {
      anonKeyConfigured: Boolean(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY),
      serviceRoleConfigured: hasServiceRoleKey(),
      supabaseConnected: false,
      supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    };

    try {
      await supabaseRestRequest('/profiles?select=id&limit=1', {
        token: getBearerToken(req),
        useServiceRole: hasServiceRoleKey(),
      });

      sendJson(res, 200, {
        ok: checks.anonKeyConfigured && checks.supabaseUrlConfigured,
        checks: {
          ...checks,
          supabaseConnected: true,
        },
      });
    } catch (error) {
      sendJson(res, 503, {
        ok: false,
        checks,
        error: error.message || 'Supabase connectivity check failed.',
      });
    }
  },

  'GET /notifications': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const rows = await readRows(
      req,
      `/notifications?recipient_id=eq.${user.id}&select=*&order=created_at.desc&limit=50`
    );

    sendJson(res, 200, asList(rows).map(mapNotification));
  },

  'PATCH /notifications': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const body = await readJson(req);
    const notificationId = cleanString(body.id || body.notificationId || body.notification_id, 80);
    const readAt = body.isRead === false || body.read === false ? null : new Date().toISOString();
    const path = notificationId
      ? `/notifications?id=eq.${notificationId}&recipient_id=eq.${user.id}`
      : `/notifications?recipient_id=eq.${user.id}&read_at=is.null`;

    if (notificationId && !isUuid(notificationId)) {
      sendError(res, 400, 'A valid notification id is required.');
      return;
    }

    const rows = await patchRows(req, path, { read_at: readAt });
    sendJson(res, 200, asList(rows).map(mapNotification));
  },

  'POST /auth/login': async (req, res) => {
    try {
      const body = await readJson(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const session = await signInWithPassword({ email, password });

      sendJson(res, 200, await sessionPayload(session));
    } catch (error) {
      sendError(res, 500, error.message || 'Unable to sign in.');
    }
  },

  'POST /auth/logout': async (req, res) => {
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
  },

  'GET /auth/me': async (req, res) => {
    const user = await getSessionUser(req);

    if (!user) {
      sendError(res, 401, 'Authentication required.');
      return;
    }

    sendJson(res, 200, { provider: 'supabase', user });
  },

  'POST /auth/refresh': async (req, res) => {
    try {
      const body = await readJson(req);
      const refreshToken = String(body.refreshToken || body.refresh_token || '');

      if (!refreshToken) {
        sendError(res, 400, 'Refresh token is required.');
        return;
      }

      const session = await refreshSession(refreshToken);
      sendJson(res, 200, await sessionPayload(session));
    } catch (error) {
      sendError(res, 401, error.message || 'Unable to refresh session.');
    }
  },

  'POST /auth/register': async (req, res) => {
    try {
      const body = await readJson(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const role = body.role === 'professional' ? 'professional' : 'client';
      const fullName = String(body.fullName || '').trim();
      const company = String(body.company || '').trim();
      const redirectTo = String(body.redirectTo || '').trim();

      if (!email || !email.includes('@')) {
        sendError(res, 400, 'A valid work email is required.');
        return;
      }

      if (password.length < 8) {
        sendError(res, 400, 'Password must be at least 8 characters.');
        return;
      }

      const session = await signUpWithPassword({
        company,
        email,
        fullName,
        password,
        redirectTo,
        role,
      });
      const user = session.user || session;

      if (!session.access_token) {
        sendJson(res, 202, {
          message: 'Account created. Check your email to confirm your account before signing in.',
          provider: 'supabase',
          requiresEmailConfirmation: true,
          user: publicUser(user),
        });
        return;
      }

      sendJson(res, 201, await sessionPayload(session));
    } catch (error) {
      sendError(res, 500, error.message || 'Unable to create account.');
    }
  },

  'GET /admin/talent': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const profiles = await loadTalentProfiles(req, { usePending: true });
    sendJson(res, 200, profiles);
  },

  'PATCH /admin/talent': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id || body.id, 80);
    const status = normalizeStatus(body.status, talentStatuses, '');

    if (!isUuid(professionalId)) {
      sendError(res, 400, 'A valid professionalId is required.');
      return;
    }

    if (!status) {
      sendError(res, 400, 'A valid talent status is required.');
      return;
    }

    const existingRows = await readRows(
      req,
      `/professional_profiles?user_id=eq.${professionalId}&select=*&limit=1`
    );
    const existingProfile = asList(existingRows)[0];

    if (!existingProfile) {
      sendError(res, 404, 'Talent profile not found.');
      return;
    }

    const pendingProfile = existingProfile.pending_profile || {};
    const hasPendingChanges = hasPendingProfile(existingProfile);
    let payload = {
      status,
      ...(status === 'approved' ? { published_at: new Date().toISOString() } : {}),
    };

    if (status === 'approved' && hasPendingChanges) {
      const pendingTitles = cleanProfessionalTitles(pendingProfile.titles ?? pendingProfile.title);

      await patchRows(req, `/profiles?id=eq.${professionalId}`, {
        ...(pendingProfile.full_name ? { full_name: pendingProfile.full_name } : {}),
        ...(Object.hasOwn(pendingProfile, 'titles') || Object.hasOwn(pendingProfile, 'title')
          ? { title: pendingTitles[0] || null }
          : {}),
      }, { prefer: 'return=minimal' });

      payload = {
        ...toProfilePatch(pendingProfile),
        pending_profile: {},
        published_at: new Date().toISOString(),
        review_status: null,
        review_submitted_at: null,
        status: 'approved',
      };
    } else if (status === 'rejected' && existingProfile.status === 'approved' && hasPendingChanges) {
      payload = {
        review_status: 'rejected',
      };
    } else if (status === 'pending_review' && existingProfile.status === 'approved' && hasPendingChanges) {
      payload = {
        review_status: 'pending_review',
      };
    } else if (['hidden', 'rejected'].includes(status)) {
      payload = {
        pending_profile: {},
        review_status: null,
        review_submitted_at: null,
        status,
      };
    }

    const rows = await patchRows(
      req,
      `/professional_profiles?user_id=eq.${professionalId}`,
      payload
    );
    const saved = asList(rows)[0];

    if (!saved) {
      sendError(res, 404, 'Talent profile not found.');
      return;
    }

    const owners = await loadProfilesById(req, [professionalId]);
    const owner = owners.get(professionalId) || {};
    const mappedProfile = mapTalentProfile(saved, owner, { usePending: true });

    if (['approved', 'rejected'].includes(status)) {
      notifyUser({
        actionUrl: '/',
        body: status === 'approved'
          ? 'Your professional profile has been approved and is now visible in the client talent directory.'
          : 'Your professional profile was not approved yet. Update your profile and submit it again when ready.',
        emailSubject: `PB Finance profile ${formatStatusLabel(status)}`,
        metadata: {
          professionalId,
          status,
        },
        recipientEmail: owner.email,
        recipientId: professionalId,
        recipientName: owner.full_name,
        title: `Profile ${formatStatusLabel(status)}`,
        type: 'profile_status_updated',
      }).catch(() => {});
    }

    sendJson(res, 200, mappedProfile);
  },

  'GET /admin/agencies': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const agencies = await readRows(
      req,
      '/agencies?select=*&order=updated_at.desc&limit=200'
    );

    sendJson(res, 200, asList(agencies).map(mapAgency));
  },

  'POST /admin/agencies': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = await readJson(req);
    const payload = buildAgencyPayload(body);

    if (!payload.name) {
      sendError(res, 400, 'Agency name is required.');
      return;
    }

    const rows = await writeRows(req, '/agencies', payload);
    sendJson(res, 201, mapAgency(asList(rows)[0] || payload));
  },

  'PATCH /admin/agencies': async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = await readJson(req);
    const agencyId = cleanString(body.id || body.agencyId || body.agency_id, 80);

    if (!isUuid(agencyId)) {
      sendError(res, 400, 'A valid agency id is required.');
      return;
    }

    const existingRows = await readRows(req, `/agencies?id=eq.${agencyId}&select=*&limit=1`);
    const existing = asList(existingRows)[0];

    if (!existing) {
      sendError(res, 404, 'Agency not found.');
      return;
    }

    const rows = await patchRows(
      req,
      `/agencies?id=eq.${agencyId}`,
      buildAgencyPayload(body, existing)
    );

    sendJson(res, 200, mapAgency(asList(rows)[0] || existing));
  },

  'GET /agencies': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const agencies = await readRows(
      req,
      '/agencies?status=eq.approved&select=*&order=updated_at.desc&limit=100'
    );

    sendJson(res, 200, asList(agencies).map(mapAgency));
  },

  'GET /client/billing': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const [contracts, invoices, paymentMethods] = await Promise.all([
      readRows(req, `/contracts?client_id=eq.${user.id}&select=*&order=created_at.desc&limit=50`),
      readRows(req, `/invoices?client_id=eq.${user.id}&select=*&order=issued_at.desc&limit=50`),
      readRows(req, `/payment_methods?client_id=eq.${user.id}&select=*&order=is_default.desc,created_at.desc&limit=10`),
    ]);

    sendJson(res, 200, {
      contracts: asList(contracts).map((contract) => ({
        amount: toNumber(contract.monthly_amount),
        billingInterval: contract.billing_interval || 'Monthly',
        id: contract.id,
        monthlyAmount: toNumber(contract.monthly_amount),
        name: contract.title,
        startDate: contract.start_date ? `Started ${formatDate(contract.start_date)}` : '',
        status: contract.status,
        title: contract.title,
      })),
      invoices: asList(invoices).map((invoice) => ({
        amount: toNumber(invoice.amount),
        date: formatDate(invoice.issued_at || invoice.created_at),
        downloadUrl: invoice.pdf_url,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
      })),
      paymentMethods: asList(paymentMethods).map((method) => ({
        brand: method.brand,
        expires: method.expires,
        holderName: method.holder_name,
        id: method.id,
        isDefault: method.is_default,
        last4: method.last4,
      })),
    });
  },

  'GET /client/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const interviews = await readRows(
      req,
      `/interviews?client_id=eq.${user.id}&client_hidden_at=is.null&status=in.(requesting,requested,scheduled,completed,cancelled)&select=*&order=updated_at.desc&limit=50`
    );
    const rows = asList(interviews);
    const owners = await loadProfilesById(req, rows.map((interview) => interview.professional_id));

    sendJson(res, 200, rows.map((interview) => {
      const parts = getMonthDay(interview.scheduled_for);
      const professional = owners.get(interview.professional_id) || {};

      return {
        candidateName: professional.full_name,
        cancellationReason: interview.cancellation_reason,
        cancelledAt: interview.cancelled_at,
        cancelledBy: interview.cancelled_by,
        day: parts.day,
        id: interview.id,
        meetingUrl: interview.meeting_url,
        month: parts.month,
        name: professional.full_name,
        role: interview.role_title || professional.title,
        scheduledFor: interview.scheduled_for,
        status: interview.status === 'requested' ? 'requesting' : interview.status,
        time: parts.time,
        title: interview.role_title || professional.title,
      };
    }));
  },

  'GET /client/shortlist': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const shortlists = await readRows(
      req,
      `/shortlists?client_id=eq.${user.id}&select=*&order=created_at.desc&limit=100`
    );
    const rows = asList(shortlists);
    const professionalIds = rows.map((row) => row.professional_id);
    const [profiles, opportunities, interviews] = await Promise.all([
      loadTalentProfiles(req, { ids: professionalIds }),
      professionalIds.length
        ? readRows(req, `/opportunities?client_id=eq.${user.id}&professional_id=${byIdFilter(professionalIds)}&status=in.(invited,accepted,active)&select=id,professional_id,status,title,received_at&order=received_at.desc&limit=100`)
        : [],
      professionalIds.length
        ? readRows(req, `/interviews?client_id=eq.${user.id}&professional_id=${byIdFilter(professionalIds)}&client_hidden_at=is.null&status=in.(requesting,requested,scheduled,cancelled)&select=id,professional_id,status,created_at,scheduled_for&order=created_at.desc&limit=100`)
        : [],
    ]);
    const shortlistByProfessional = new Map(rows.map((row) => [row.professional_id, row]));
    const latestOpportunityByProfessional = new Map();
    const latestInterviewByProfessional = new Map();

    asList(opportunities).forEach((opportunity) => {
      setPreferredByStatus(latestOpportunityByProfessional, opportunity, opportunityStatusPriority);
    });

    asList(interviews).forEach((interview) => {
      setPreferredByStatus(latestInterviewByProfessional, interview, interviewStatusPriority);
    });

    sendJson(res, 200, profiles.map((profile) => {
      const shortlist = shortlistByProfessional.get(profile.id);
      const latestOpportunity = latestOpportunityByProfessional.get(profile.id);
      const latestInterview = latestInterviewByProfessional.get(profile.id);

      return {
        ...profile,
        interviewStatus: latestInterview?.status,
        latestInterviewId: latestInterview?.id,
        latestOpportunityId: latestOpportunity?.id,
        opportunityStatus: latestOpportunity?.status,
        shortlistId: shortlist?.id,
        shortlistStatus: shortlist?.status,
      };
    }));
  },

  'POST /client/shortlist': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id, 80);
    const professionalProfile = await getProfessionalProfile(req, professionalId, { requireApproved: true });

    if (!professionalProfile) {
      sendError(res, 404, 'Approved talent profile not found.');
      return;
    }

    const rows = await writeRows(
      req,
      '/shortlists?on_conflict=client_id,professional_id',
      {
        client_id: user.id,
        notes: cleanString(body.notes, 1000),
        professional_id: professionalId,
        status: 'saved',
      },
      { prefer: 'resolution=merge-duplicates,return=representation' }
    );

    sendJson(res, 201, asList(rows)[0] || { ok: true });
  },

  'DELETE /client/shortlist': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id, 80);

    if (!isUuid(professionalId)) {
      sendError(res, 400, 'A valid professionalId is required.');
      return;
    }

    await supabaseRestRequest(
      `/shortlists?client_id=eq.${user.id}&professional_id=eq.${professionalId}`,
      {
        ...getDataOptions(req),
        method: 'DELETE',
        prefer: 'return=minimal',
      }
    );

    sendJson(res, 200, { ok: true });
  },

  'POST /client/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const professionalId = cleanString(body.professionalId || body.professional_id, 80);
    const professionalProfile = await getProfessionalProfile(req, professionalId, { requireApproved: true });

    if (!professionalProfile) {
      sendError(res, 404, 'Approved talent profile not found.');
      return;
    }

    const [activeOpportunities, activeInterviews] = await Promise.all([
      readRows(
        req,
        `/opportunities?client_id=eq.${user.id}&professional_id=eq.${professionalId}&status=in.(invited,accepted,active)&select=id,status&limit=1`
      ),
      readRows(
        req,
        `/interviews?client_id=eq.${user.id}&professional_id=eq.${professionalId}&status=in.(requesting,requested,scheduled)&select=id,status&limit=1`
      ),
    ]);

    if (asList(activeInterviews).length) {
      sendError(res, 409, 'There is already an active interview request for this professional.');
      return;
    }

    const owners = await loadProfilesById(req, [professionalId]);
    const professionalOwner = owners.get(professionalId) || {};
    const title = cleanString(body.title || body.roleTitle || professionalOwner.title || 'Finance interview', 160);
    const scheduledFor = cleanString(body.scheduledFor || body.scheduled_for, 80);
    const scheduledParts = getMonthDay(scheduledFor);
    const schedule = scheduledFor
      ? `Interview requested for ${formatDate(scheduledFor)} at ${scheduledParts.time}`
      : 'Interview requested';
    const companyName = await getPrimaryClientCompanyName(req, user.id, user.company);
    const durationMinutes = Number(body.durationMinutes || body.duration_minutes || 30);

    let opportunity = asList(activeOpportunities)[0];

    if (!opportunity) {
      const opportunityRows = await writeRows(req, '/opportunities', {
        client_id: user.id,
        company_name: companyName,
        description: cleanString(body.description || `Interview requested by ${companyName}.`, 1000),
        hourly_rate: toNumber(body.hourlyRate || body.hourly_rate || professionalProfile.hourly_rate),
        professional_id: professionalId,
        schedule,
        status: 'invited',
        title,
      });
      opportunity = asList(opportunityRows)[0];
    }
    const interviewRows = await writeRows(req, '/interviews', {
      client_id: user.id,
      duration_minutes: Number.isFinite(durationMinutes) ? durationMinutes : 30,
      meeting_url: cleanString(body.meetingUrl || body.meeting_url, 500),
      opportunity_id: opportunity?.id,
      professional_id: professionalId,
      role_title: title,
      scheduled_for: scheduledFor || null,
      status: 'requesting',
    });
    const interview = asList(interviewRows)[0] || null;

    patchRows(
      req,
      `/shortlists?client_id=eq.${user.id}&professional_id=eq.${professionalId}`,
      { status: 'contacted' },
      { prefer: 'return=minimal' }
    ).catch(() => {});

    notifyUser({
      actionUrl: '/',
      body: `${companyName} requested an interview for ${title}.`,
      emailSubject: `New interview request from ${companyName}`,
      metadata: {
        clientId: user.id,
        interviewId: interview?.id,
        opportunityId: opportunity?.id,
        professionalId,
      },
      recipientEmail: professionalOwner.email,
      recipientId: professionalId,
      recipientName: professionalOwner.full_name,
      title: 'New interview request',
      type: 'interview_requested',
    }).catch(() => {});

    sendJson(res, 201, {
      interview,
      opportunity,
    });
  },

  'PATCH /client/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const interviewId = cleanString(body.id || body.interviewId || body.interview_id, 80);
    const reason = cleanString(body.reason || body.cancellationReason || body.cancellation_reason, 1000);

    if (!isUuid(interviewId)) {
      sendError(res, 400, 'A valid interview id is required.');
      return;
    }

    if (!reason) {
      sendError(res, 400, 'Cancellation reason is required.');
      return;
    }

    const interview = await cancelInterview(req, {
      actor: user,
      allowedRole: 'client',
      interviewId,
      reason,
    });

    if (!interview) {
      sendError(res, 404, 'Active interview not found.');
      return;
    }

    const owners = await loadProfilesById(req, [interview.professional_id]);
    const professional = owners.get(interview.professional_id) || {};

    notifyUser({
      actionUrl: '/',
      body: `${user.company || user.name || 'A client'} cancelled an interview. Reason: ${reason}`,
      emailSubject: 'Interview cancelled',
      metadata: {
        cancelledBy: user.id,
        interviewId: interview.id,
        reason,
      },
      recipientEmail: professional.email,
      recipientId: interview.professional_id,
      recipientName: professional.full_name,
      title: 'Interview cancelled',
      type: 'interview_cancelled',
    }).catch(() => {});

    sendJson(res, 200, interview);
  },

  'DELETE /client/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const interviewId = cleanString(body.id || body.interviewId || body.interview_id, 80);

    if (!isUuid(interviewId)) {
      sendError(res, 400, 'A valid interview id is required.');
      return;
    }

    const rows = await patchRows(
      req,
      `/interviews?id=eq.${interviewId}&client_id=eq.${user.id}&status=eq.cancelled`,
      { client_hidden_at: new Date().toISOString() },
      { prefer: 'return=representation' }
    );

    if (!asList(rows)[0]) {
      sendError(res, 404, 'Cancelled interview not found.');
      return;
    }

    sendJson(res, 200, { ok: true });
  },

  'POST /matchmaker/suggestions': async (req, res) => {
    const user = await requireSession(req, res, ['client']);
    if (!user) return;

    const body = await readJson(req);
    const message = String(body.message || '').trim();

    if (!message) {
      sendError(res, 400, 'Tell the matchmaker what you need.');
      return;
    }

    const [talent, agencyRows] = await Promise.all([
      loadTalentProfiles(req, { onlyApproved: true }),
      readRows(req, '/agencies?status=eq.approved&select=*&order=updated_at.desc&limit=100'),
    ]);
    const agencies = asList(agencyRows).map(mapAgency);
    const tokens = tokenize(message);
    const talentMatches = talent
      .map((profile) => ({
        match: profile,
        score: scoreMatch(tokens, profile, ['title', 'role', 'bio', 'skills', 'tools', 'industries']),
        type: 'talent',
      }))
      .filter((item) => item.score > 0);
    const agencyMatches = agencies
      .map((agency) => ({
        match: agency,
        score: scoreMatch(tokens, agency, ['name', 'specialty', 'description', 'tools', 'certifications']),
        type: 'agency',
      }))
      .filter((item) => item.score > 0);
    const matches = [...talentMatches, ...agencyMatches]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    writeRows(req, '/match_requests', {
      client_id: user.id,
      message,
      result_count: matches.length,
    }, { prefer: 'return=minimal' }).catch(() => {});

    sendJson(res, 200, {
      matches: matches.map((item) => item.match),
      message: matches.length
        ? `I found ${matches.length} relevant match${matches.length === 1 ? '' : 'es'} for that request.`
        : 'No recommendations are available yet.',
      type: matches[0]?.type || 'talent',
    });
  },

  'GET /talent/earnings': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const timesheets = await readRows(
      req,
      `/timesheets?professional_id=eq.${user.id}&select=*&order=period_end.desc&limit=100`
    );
    const currentYear = new Date().getFullYear();
    const rows = asList(timesheets);
    const amountFor = (statuses) => rows
      .filter((sheet) => statuses.includes(sheet.status))
      .reduce((total, sheet) => total + (toNumber(sheet.amount) || 0), 0);
    const totalEarnedYtd = rows
      .filter((sheet) => {
        const paidAt = sheet.paid_at || sheet.approved_at || sheet.period_end;
        return paidAt && new Date(paidAt).getFullYear() === currentYear;
      })
      .reduce((total, sheet) => total + (toNumber(sheet.amount) || 0), 0);

    sendJson(res, 200, {
      availableToWithdraw: amountFor(['approved']),
      pendingReview: amountFor(['submitted']),
      timesheets: rows.map((sheet) => ({
        amount: toNumber(sheet.amount),
        hours: toNumber(sheet.hours),
        id: sheet.id,
        period: sheet.period_start && sheet.period_end
          ? `${formatDate(sheet.period_start)} - ${formatDate(sheet.period_end)}`
          : 'Period pending',
        status: sheet.status ? sheet.status.charAt(0).toUpperCase() + sheet.status.slice(1) : 'Pending',
      })),
      totalEarnedYtd,
    });
  },

  'GET /talent/me': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const profiles = await readRows(
      req,
      `/professional_profiles?user_id=eq.${user.id}&select=*&limit=1`
    );
    const professionalProfile = asList(profiles)[0];

    sendJson(res, 200, professionalProfile
      ? mapTalentProfile(professionalProfile, {
        email: user.email,
        full_name: user.name,
        title: user.title,
      }, { usePending: true })
      : user);
  },

  'PATCH /talent/me': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const body = await readJson(req);
    const currentProfile = await getProfessionalProfile(req, user.id);
    const fullName = cleanString(body.fullName || body.name || user.name, 160);
    const existingPendingProfile = currentProfile?.pending_profile || {};
    const fallbackTitles = cleanProfessionalTitles(
      existingPendingProfile.titles ?? existingPendingProfile.title,
      cleanProfessionalTitles(currentProfile?.titles, cleanProfessionalTitles(user.title))
    );
    const titles = cleanProfessionalTitles(body.titles ?? body.title ?? body.role, fallbackTitles);
    const primaryTitle = titles[0] || '';
    const hourlyRate = toNumber(body.hourlyRate ?? body.rate ?? body.hourly_rate);
    const yearsExperience = toNumber(body.yearsExperience ?? body.years_experience ?? body.experience);

    const profilePayload = {
      availability: normalizeAvailability(body.availability || body.available),
      bio: cleanString(body.bio, 2000),
      certifications: cleanList(body.certifications),
      country: cleanString(body.country || 'Philippines', 100),
      full_name: fullName,
      hourly_rate: hourlyRate,
      industries: cleanList(body.industries),
      location: cleanString(body.location, 160),
      skills: cleanList(body.skills),
      titles,
      tools: cleanList(body.tools),
      work_preferences: typeof body.workPreferences === 'object' && body.workPreferences !== null
        ? body.workPreferences
        : {},
      years_experience: yearsExperience,
    };
    let rows;

    if (currentProfile?.status === 'approved') {
      rows = await patchRows(
        req,
        `/professional_profiles?user_id=eq.${user.id}`,
        {
          pending_profile: profilePayload,
          review_status: 'pending_review',
          review_submitted_at: new Date().toISOString(),
        }
      );
    } else {
      await patchRows(req, `/profiles?id=eq.${user.id}`, {
        full_name: fullName,
        title: primaryTitle || null,
      }, { prefer: 'return=minimal' });

      rows = await writeRows(
        req,
        '/professional_profiles?on_conflict=user_id',
        {
          ...toProfilePatch(profilePayload),
          pending_profile: {},
          review_status: null,
          review_submitted_at: null,
          status: 'pending_review',
          user_id: user.id,
        },
        { prefer: 'resolution=merge-duplicates,return=representation' }
      );
    }

    const savedProfile = asList(rows)[0];
    const shouldNotifyAdmins = savedProfile?.status === 'pending_review'
      || savedProfile?.review_status === 'pending_review';

    if (shouldNotifyAdmins) {
      notifyAdmins({
        actionUrl: '/',
        body: `${fullName} submitted an updated professional profile for review.`,
        emailSubject: 'New PB Finance talent profile for review',
        metadata: {
          professionalId: user.id,
          status: savedProfile.status,
        },
        title: 'Talent profile pending review',
        type: 'talent_profile_submitted',
      }).catch(() => {});
    }

    sendJson(res, 200, mapTalentProfile(savedProfile, {
      email: user.email,
      full_name: fullName,
      title: primaryTitle,
    }, { usePending: true }));
  },

  'GET /talent/opportunities': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const opportunities = await readRows(
      req,
      `/opportunities?professional_id=eq.${user.id}&status=neq.closed&select=*&order=received_at.desc&limit=50`
    );
    const opportunityRows = asList(opportunities);
    const clientProfiles = await loadProfilesById(
      req,
      opportunityRows.map((opportunity) => opportunity.client_id)
    );
    const opportunityIds = opportunityRows.map((opportunity) => opportunity.id);
    const interviewRows = opportunityIds.length
      ? await readRows(
        req,
        `/interviews?opportunity_id=${byIdFilter(opportunityIds)}&professional_id=eq.${user.id}&professional_hidden_at=is.null&select=*&limit=100`
      )
      : [];
    const interviewsByOpportunity = new Map(asList(interviewRows).map((interview) => [interview.opportunity_id, interview]));

    sendJson(res, 200, opportunityRows.map((opportunity) => {
      const client = clientProfiles.get(opportunity.client_id) || {};
      const interview = interviewsByOpportunity.get(opportunity.id) || {};
      const effectiveStatus = interview.status === 'cancelled' ? 'cancelled' : opportunity.status;

      const scheduledParts = getMonthDay(interview.scheduled_for);
      const interviewSchedule = interview.scheduled_for
        ? `${formatDate(interview.scheduled_for)} at ${scheduledParts.time}`
        : opportunity.schedule;

      return {
        cancellationReason: interview.cancellation_reason,
        cancelledAt: interview.cancelled_at,
        cancelledBy: interview.cancelled_by,
        clientName: opportunity.company_name || client.company || client.full_name,
        company: opportunity.company_name || client.company || client.full_name,
        date: formatDate(opportunity.received_at),
        description: opportunity.description,
        duration: interviewSchedule,
        hourlyRate: toNumber(opportunity.hourly_rate),
        id: opportunity.id,
        interviewId: interview.id,
        interviewStatus: interview.status,
        rate: toNumber(opportunity.hourly_rate),
        receivedAt: formatDate(opportunity.received_at),
        role: opportunity.title,
        schedule: interviewSchedule,
        status: effectiveStatus,
        title: opportunity.title,
      };
    }));
  },

  'PATCH /talent/opportunities': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const body = await readJson(req);
    const opportunityId = cleanString(body.id || body.opportunityId || body.opportunity_id, 80);
    const status = cleanString(body.status, 40);

    if (!isUuid(opportunityId)) {
      sendError(res, 400, 'A valid opportunity id is required.');
      return;
    }

    if (!['accepted', 'declined'].includes(status)) {
      sendError(res, 400, 'Opportunity status must be accepted or declined.');
      return;
    }

    const existing = await readRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}&select=*&limit=1`
    );

    const opportunity = asList(existing)[0];

    if (!opportunity) {
      sendError(res, 404, 'Opportunity not found.');
      return;
    }

    const interviewRows = await readRows(
      req,
      `/interviews?opportunity_id=eq.${opportunityId}&professional_id=eq.${user.id}&select=*&limit=1`
    );
    const interview = asList(interviewRows)[0];

    if (opportunity.status !== 'invited' || !['requesting', 'requested'].includes(interview?.status)) {
      sendError(res, 409, 'This interview request is no longer available.');
      return;
    }

    const rows = await patchRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}&status=eq.invited`,
      { status }
    );

    if (!asList(rows)[0]) {
      sendError(res, 409, 'This interview request is no longer available.');
      return;
    }

    await patchRows(
      req,
      `/interviews?id=eq.${interview.id}&professional_id=eq.${user.id}&status=in.(requesting,requested)`,
      { status: status === 'accepted' ? 'scheduled' : 'cancelled' },
      { prefer: 'return=minimal' }
    ).catch(() => {});

    const clientProfiles = await loadProfilesById(req, [opportunity.client_id]);
    const client = clientProfiles.get(opportunity.client_id) || {};

    notifyUser({
      actionUrl: '/',
      body: `${user.name || 'A professional'} ${status} your interview request for ${opportunity.title}.`,
      emailSubject: `Interview request ${formatStatusLabel(status)}`,
      metadata: {
        clientId: opportunity.client_id,
        opportunityId,
        professionalId: user.id,
        status,
      },
      recipientEmail: client.email,
      recipientId: opportunity.client_id,
      recipientName: client.full_name,
      title: `Interview ${formatStatusLabel(status)}`,
      type: `interview_${status}`,
    }).catch(() => {});

    sendJson(res, 200, asList(rows)[0] || { ok: true, status });
  },

  'DELETE /talent/opportunities': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const body = await readJson(req);
    const opportunityId = cleanString(body.id || body.opportunityId || body.opportunity_id, 80);

    if (!isUuid(opportunityId)) {
      sendError(res, 400, 'A valid opportunity id is required.');
      return;
    }

    const existing = await readRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}&status=in.(declined,cancelled)&select=*&limit=1`
    );

    if (!asList(existing)[0]) {
      sendError(res, 404, 'Removable opportunity not found.');
      return;
    }

    await patchRows(
      req,
      `/opportunities?id=eq.${opportunityId}&professional_id=eq.${user.id}`,
      { status: 'closed' },
      { prefer: 'return=minimal' }
    );

    await patchRows(
      req,
      `/interviews?opportunity_id=eq.${opportunityId}&professional_id=eq.${user.id}`,
      { professional_hidden_at: new Date().toISOString() },
      { prefer: 'return=minimal' }
    ).catch(() => {});

    sendJson(res, 200, { ok: true });
  },

  'PATCH /talent/interviews': async (req, res) => {
    const user = await requireSession(req, res, ['professional']);
    if (!user) return;

    const body = await readJson(req);
    const interviewId = cleanString(body.id || body.interviewId || body.interview_id, 80);
    const opportunityId = cleanString(body.opportunityId || body.opportunity_id, 80);
    const reason = cleanString(body.reason || body.cancellationReason || body.cancellation_reason, 1000);

    if (!isUuid(interviewId) && !isUuid(opportunityId)) {
      sendError(res, 400, 'A valid interview id or opportunity id is required.');
      return;
    }

    if (!reason) {
      sendError(res, 400, 'Cancellation reason is required.');
      return;
    }

    const interview = await cancelInterview(req, {
      actor: user,
      allowedRole: 'professional',
      interviewId: isUuid(interviewId) ? interviewId : '',
      opportunityId: isUuid(opportunityId) ? opportunityId : '',
      reason,
    });

    if (!interview) {
      sendError(res, 404, 'Active interview not found.');
      return;
    }

    const clientProfiles = await loadProfilesById(req, [interview.client_id]);
    const client = clientProfiles.get(interview.client_id) || {};

    notifyUser({
      actionUrl: '/',
      body: `${user.name || 'A professional'} cancelled an interview. Reason: ${reason}`,
      emailSubject: 'Interview cancelled',
      metadata: {
        cancelledBy: user.id,
        interviewId: interview.id,
        reason,
      },
      recipientEmail: client.email,
      recipientId: interview.client_id,
      recipientName: client.full_name,
      title: 'Interview cancelled',
      type: 'interview_cancelled',
    }).catch(() => {});

    sendJson(res, 200, interview);
  },

  'GET /talent/profiles': async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const profiles = await loadTalentProfiles(req, { onlyApproved: true });
    sendJson(res, 200, profiles);
  },
};

const allowedMethodsForPath = (routePath) => Object.keys(handlers)
  .map((key) => key.split(' '))
  .filter(([, path]) => path === routePath)
  .map(([method]) => method);

const requestCounts = new Map();
const checkRateLimit = (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  const record = requestCounts.get(ip);
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return true;
  }

  record.count += 1;
  if (record.count > 150) {
    sendError(res, 429, 'Too many requests, please try again later.');
    return false;
  }
  return true;
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (!checkRateLimit(req, res)) return;

  const routePath = getRoutePath(req);
  const route = handlers[`${req.method} ${routePath}`];

  if (route) {
    try {
      await route(req, res);
    } catch (error) {
      sendError(res, 500, error.message || 'Request failed.');
    }
    return;
  }

  const allowedMethods = allowedMethodsForPath(routePath);

  if (allowedMethods.length) {
    res.setHeader('Allow', allowedMethods.join(', '));
    sendError(res, 405, 'Method not allowed.');
    return;
  }

  sendError(res, 404, 'API route not found.');
}
