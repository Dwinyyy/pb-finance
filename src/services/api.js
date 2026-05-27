const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

const toQueryString = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ).toString();

  return query ? `?${query}` : '';
};

export const isBackendConfigured = () => API_BASE_URL.length > 0;

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

  if (!response.ok) {
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  if (response.status === 204) {
    return null;
  }

  return responseBody;
}

export const backendApi = {
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
    logout: () => request('/auth/logout', { method: 'POST', retryAuth: false }),
    register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
    me: () => request('/auth/me'),
    refresh: (refreshToken) => request('/auth/refresh', { method: 'POST', body: { refreshToken }, retryAuth: false }),
  },
  talent: {
    listProfiles: (params) => request(`/talent/profiles${toQueryString(params)}`),
    getMyProfile: () => request('/talent/me'),
    updateMyProfile: (payload) => request('/talent/me', { method: 'PATCH', body: payload }),
    listOpportunities: () => request('/talent/opportunities'),
    updateOpportunity: (payload) => request('/talent/opportunities', { method: 'PATCH', body: payload }),
    removeOpportunity: (payload) => request('/talent/opportunities', { method: 'DELETE', body: payload }),
    cancelInterview: (payload) => request('/talent/interviews', { method: 'PATCH', body: payload }),
    getEarnings: () => request('/talent/earnings'),
  },
  client: {
    listAgencies: (params) => request(`/agencies${toQueryString(params)}`),
    listShortlist: () => request('/client/shortlist'),
    saveShortlist: (payload) => request('/client/shortlist', { method: 'POST', body: payload }),
    removeShortlist: (payload) => request('/client/shortlist', { method: 'DELETE', body: payload }),
    listInterviews: () => request('/client/interviews'),
    requestInterview: (payload) => request('/client/interviews', { method: 'POST', body: payload }),
    cancelInterview: (payload) => request('/client/interviews', { method: 'PATCH', body: payload }),
    removeInterview: (payload) => request('/client/interviews', { method: 'DELETE', body: payload }),
    getBilling: () => request('/client/billing'),
  },
  matchmaker: {
    suggestMatches: (payload) => request('/matchmaker/suggestions', { method: 'POST', body: payload }),
  },
  notifications: {
    list: () => request('/notifications'),
    markRead: (payload) => request('/notifications', { method: 'PATCH', body: payload }),
    markAllRead: () => request('/notifications', { method: 'PATCH', body: {} }),
  },
  admin: {
    listTalent: () => request('/admin/talent'),
    updateTalentStatus: (payload) => request('/admin/talent', { method: 'PATCH', body: payload }),
    listAgencies: () => request('/admin/agencies'),
    createAgency: (payload) => request('/admin/agencies', { method: 'POST', body: payload }),
    updateAgency: (payload) => request('/admin/agencies', { method: 'PATCH', body: payload }),
  },
};
