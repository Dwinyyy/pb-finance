const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const API_BASE_URL = rawBaseUrl.replace(/\/$/, '');

const toQueryString = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ).toString();

  return query ? `?${query}` : '';
};

export const isBackendConfigured = () => API_BASE_URL.length > 0;

async function request(path, { method = 'GET', body, headers = {}, ...options } = {}) {
  if (!isBackendConfigured()) {
    throw new Error('Backend API is not configured. Set VITE_API_BASE_URL to enable requests.');
  }

  const token = localStorage.getItem('pb_auth_token');
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const backendApi = {
  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
    register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
    me: () => request('/auth/me'),
  },
  talent: {
    listProfiles: (params) => request(`/talent/profiles${toQueryString(params)}`),
    getMyProfile: () => request('/talent/me'),
    listOpportunities: () => request('/talent/opportunities'),
    getEarnings: () => request('/talent/earnings'),
  },
  client: {
    listAgencies: (params) => request(`/agencies${toQueryString(params)}`),
    listShortlist: () => request('/client/shortlist'),
    listInterviews: () => request('/client/interviews'),
    getBilling: () => request('/client/billing'),
  },
  matchmaker: {
    suggestMatches: (payload) => request('/matchmaker/suggestions', { method: 'POST', body: payload }),
  },
};
