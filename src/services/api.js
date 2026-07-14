const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

const toQueryString = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ).toString();

  return query ? `?${query}` : '';
};

export const isBackendConfigured = () => true;

const getAccessToken = () => localStorage.getItem('pb_auth_token');
const getRefreshToken = () => localStorage.getItem('pb_refresh_token');
const notifyAuthUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pb-auth-updated'));
  }
};

export const storeAuthSession = (session) => {
  if (session?.token) {
    localStorage.setItem('pb_auth_token', session.token);
  }

  if (session?.refreshToken) {
    localStorage.setItem('pb_refresh_token', session.refreshToken);
  }

  notifyAuthUpdated();
};

export const clearAuthSession = () => {
  localStorage.removeItem('pb_auth_token');
  localStorage.removeItem('pb_refresh_token');
  notifyAuthUpdated();
};

const parseBody = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const getErrorMessage = (body, status) => {
  if (typeof body === 'string') {
    const isHtml = body.trim().startsWith('<') && body.toLowerCase().includes('html');
    if (isHtml) {
      return `A server error occurred (Status ${status}). Please try again later.`;
    }
    return body;
  }

  return body?.error || body?.message || body?.msg || `Request failed with status ${status}`;
};

const sendRequest = (path, { method, body, headers, ...options }) => {
  const token = getAccessToken();

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...options,
  });
};

export const refreshAuthSession = async () => {
  const refreshToken = getRefreshToken();

  if (!refreshToken || !isBackendConfigured()) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
  const body = await parseBody(response);

  if (!response.ok) {
    clearAuthSession();
    return null;
  }

  storeAuthSession(body);
  return body;
};

async function request(path, { method = 'GET', body, headers = {}, retryAuth = true, ...options } = {}) {
  if (!isBackendConfigured()) {
    throw new Error('Backend API is not configured. Set VITE_API_BASE_URL to enable requests.');
  }

  let response = await sendRequest(path, {
    method,
    body,
    headers,
    ...options,
  });

  if (response.status === 401 && retryAuth && path !== '/auth/refresh') {
    const refreshed = await refreshAuthSession();

    if (refreshed?.token) {
      response = await sendRequest(path, {
        method,
        body,
        headers,
        ...options,
      });
    }
  }

  const responseBody = await parseBody(response);
  const receivedHtml = typeof responseBody === 'string'
    && responseBody.trim().startsWith('<')
    && responseBody.toLowerCase().includes('<html');

  if (!response.ok || receivedHtml) {
    const error = new Error(getErrorMessage(responseBody, response.status));
    error.status = receivedHtml && response.ok ? 502 : response.status;
    error.body = responseBody;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return responseBody;
}

async function requestBlob(path, { method = 'POST', body, headers = {}, retryAuth = true, ...options } = {}) {
  let response = await sendRequest(path, {
    method,
    body,
    headers,
    ...options,
  });

  if (response.status === 401 && retryAuth && path !== '/auth/refresh') {
    const refreshed = await refreshAuthSession();

    if (refreshed?.token) {
      response = await sendRequest(path, {
        method,
        body,
        headers,
        ...options,
      });
    }
  }

  if (!response.ok) {
    const responseBody = await parseBody(response);
    const error = new Error(getErrorMessage(responseBody, response.status));
    error.status = response.status;
    error.body = responseBody;
    throw error;
  }

  const contentType = response.headers.get('Content-Type') || '';
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const fileNameMatch = contentDisposition.match(/filename="([^"]+)"/i);

  return {
    blob: await response.blob(),
    contentType,
    fileName: fileNameMatch?.[1] || '',
  };
}

export const backendApi = {
  auth: {
    finalizeOAuth: (payload) => request('/auth/oauth/finalize', { method: 'POST', body: payload }),
    google: (payload) => request('/auth/google', { method: 'POST', body: payload, retryAuth: false }),
    completePasswordSetup: (payload) => request('/auth/password/setup/complete', { method: 'POST', body: payload }),
    requestGoogleLink: (payload) => request('/auth/link/google/request', { method: 'POST', body: payload }),
    requestPasswordSetup: (payload) => request('/auth/password/setup/request', { method: 'POST', body: payload, retryAuth: false }),
    login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
    logout: () => request('/auth/logout', { method: 'POST', retryAuth: false }),
    register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
    verifyGoogleLink: (payload) => request('/auth/link/google/verify', { method: 'POST', body: payload }),
    verifyPasswordSetup: (payload) => request('/auth/password/setup/verify', { method: 'POST', body: payload, retryAuth: false }),
    verifyRegistration: (payload) => request('/auth/register/verify', { method: 'POST', body: payload, retryAuth: false }),
    me: () => request('/auth/me'),
    refresh: (refreshToken) => request('/auth/refresh', { method: 'POST', body: { refreshToken }, retryAuth: false }),
  },
  talent: {
    listProfiles: (params) => request(`/talent/profiles${toQueryString(params)}`),
    getMyProfile: () => request('/talent/me'),
    getProfilePreview: (params) => request(`/talent/profile-preview${toQueryString(params)}`),
    updateMyProfile: (payload) => request('/talent/me', { method: 'PATCH', body: payload }),
    updateVisibility: (payload) => request('/talent/visibility', { method: 'PATCH', body: payload }),
    listOpportunities: () => request('/talent/opportunities'),
    updateOpportunity: (payload) => request('/talent/opportunities', { method: 'PATCH', body: payload }),
    removeOpportunity: (payload) => request('/talent/opportunities', { method: 'DELETE', body: payload }),
    cancelInterview: (payload) => request('/talent/interviews', { method: 'PATCH', body: payload }),
    listJobs: () => request('/talent/jobs'),
    commentOnJob: (payload) => request('/talent/job-comments', { method: 'POST', body: payload }),
    contactClientFromJob: (payload) => request('/talent/job-contacts', { method: 'POST', body: payload }),
    getEarnings: () => request('/talent/earnings'),
    uploadCredential: (payload) => request('/talent/uploads', { method: 'POST', body: payload }),
    uploadIdentity: (payload) => request('/talent/identity-uploads', { method: 'POST', body: payload }),
    uploadProfilePhoto: (payload) => request('/talent/profile-photo', { method: 'POST', body: payload }),
    requestDocumentChange: (payload) => request('/talent/document-request', { method: 'POST', body: payload }),
  },
  documents: {
    getBlob: (payload) => requestBlob('/documents/blob', { method: 'POST', body: payload }),
    getUrl: (payload) => request('/documents/url', { method: 'POST', body: payload }),
  },
  client: {
    getPermissions: () => request('/client/permissions'),
    getVerification: () => request('/client/verification'),
    uploadVerificationDocument: (payload) => request('/client/verification/uploads', { method: 'POST', body: payload }),
    submitVerification: () => request('/client/verification/submit', { method: 'POST' }),
    getVerificationDocumentUrl: (payload) => request('/client/verification/document-url', { method: 'POST', body: payload }),
    listJobs: () => request('/client/jobs'),
    postJob: (payload) => request('/client/jobs', { method: 'POST', body: payload }),
    listAgencies: (params) => request(`/agencies${toQueryString(params)}`),
    listShortlist: () => request('/client/shortlist'),
    saveShortlist: (payload) => request('/client/shortlist', { method: 'POST', body: payload }),
    removeShortlist: (payload) => request('/client/shortlist', { method: 'DELETE', body: payload }),
    listInterviews: () => request('/client/interviews'),
    requestInterview: (payload) => request('/client/interviews', { method: 'POST', body: payload }),
    cancelInterview: (payload) => request('/client/interviews', { method: 'PATCH', body: payload }),
    removeInterview: (payload) => request('/client/interviews', { method: 'DELETE', body: payload }),
    listReviews: (params) => request(`/client/reviews${toQueryString(params)}`),
    leaveReview: (payload) => request('/client/reviews', { method: 'POST', body: payload }),
    listBackgroundChecks: () => request('/client/background-checks'),
    requestBackgroundCheck: (payload) => request('/client/background-checks', { method: 'POST', body: payload }),
    getBilling: () => request('/client/billing'),
  },
  matchmaker: {
    suggestMatches: (payload) => request('/matchmaker/suggestions', { method: 'POST', body: payload }),
  },
  notifications: {
    list: () => request('/notifications'),
    markRead: (payload) => request('/notifications', { method: 'PATCH', body: payload }),
    markAllRead: () => request('/notifications', { method: 'PATCH', body: {} }),
    getPushConfig: () => request('/notifications/push-config'),
    savePushSubscription: (payload) => request('/notifications/push-subscription', { method: 'POST', body: payload }),
    removePushSubscription: (payload) => request('/notifications/push-subscription', { method: 'DELETE', body: payload }),
  },
  admin: {
    listClientVerifications: () => request('/admin/client-verifications'),
    decideClientVerification: (payload) => request('/admin/client-verifications/decision', { method: 'POST', body: payload }),
    resetClientVerification: (payload) => request('/admin/client-verifications/reset', { method: 'POST', body: payload }),
    listTalent: () => request('/admin/talent'),
    updateTalentStatus: (payload) => request('/admin/talent', { method: 'PATCH', body: payload }),
    listAgencies: () => request('/admin/agencies'),
    createAgency: (payload) => request('/admin/agencies', { method: 'POST', body: payload }),
    updateAgency: (payload) => request('/admin/agencies', { method: 'PATCH', body: payload }),
  },
};
