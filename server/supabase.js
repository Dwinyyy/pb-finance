const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required for auth.');
  }

  const baseUrl = url.replace(/\/$/, '');

  return {
    authUrl: `${baseUrl}/auth/v1`,
    baseUrl,
    key,
    restUrl: `${baseUrl}/rest/v1`,
    serviceRoleKey,
  };
};

const parseResponse = async (response) => {
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.error_description
        || data?.msg
        || data?.message
        || data?.error
        || 'Supabase auth request failed.'
    );
  }

  return data;
};

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const getBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const [scheme, token] = String(header).split(' ');

  return scheme?.toLowerCase() === 'bearer' ? token : '';
};

export const publicUser = (user) => {
  const metadata = user?.user_metadata || {};
  const email = normalizeEmail(user?.email);
  const fallbackName = email ? email.split('@')[0].replace(/[._-]+/g, ' ') : 'PB Finance User';
  const role = ['admin', 'professional'].includes(metadata.role) ? metadata.role : 'client';

  return {
    company: metadata.company || '',
    email,
    id: user?.id,
    name: metadata.full_name || metadata.name || fallbackName,
    role,
    title: metadata.title || (role === 'professional' ? 'Complete your profile' : ''),
  };
};

export const supabaseAuthRequest = async (path, { body, method, token } = {}) => {
  const { authUrl, key } = getSupabaseConfig();
  const response = await fetch(`${authUrl}${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse(response);
};

export const supabaseAuthAdminRequest = async (path, { body, method } = {}) => {
  const { authUrl, key, serviceRoleKey } = getSupabaseConfig();

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for account linking.');
  }

  const response = await fetch(`${authUrl}${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      apikey: key,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse(response);
};

export const supabaseRestRequest = async (path, {
  body,
  method,
  prefer,
  token,
  useServiceRole = false,
} = {}) => {
  const { key, restUrl, serviceRoleKey } = getSupabaseConfig();
  const bearer = useServiceRole && serviceRoleKey ? serviceRoleKey : token || key;
  const response = await fetch(`${restUrl}${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      apikey: key,
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return parseResponse(response);
};

export const supabaseStorageRequest = async (path, {
  body,
  contentType,
  headers = {},
  method = 'GET',
} = {}) => {
  const { baseUrl, key, serviceRoleKey } = getSupabaseConfig();

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for file uploads.');
  }

  const isBinaryBody = body instanceof Uint8Array || Buffer.isBuffer(body);
  const response = await fetch(`${baseUrl}/storage/v1${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json',
      ...(body && !isBinaryBody ? { 'Content-Type': 'application/json' } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...headers,
    },
    body: body && isBinaryBody ? body : body ? JSON.stringify(body) : undefined,
  });

  return parseResponse(response);
};

export const signUpWithPassword = ({ email, password, fullName, company, redirectTo, role }) => {
  const redirectQuery = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';

  return supabaseAuthRequest(`/signup${redirectQuery}`, {
    body: {
      email,
      password,
      data: {
        company,
        full_name: fullName,
        name: fullName,
        role,
        title: role === 'professional' ? 'Complete your profile' : '',
      },
    },
  });
};

export const signInWithPassword = ({ email, password }) => supabaseAuthRequest('/token?grant_type=password', {
  body: {
    email,
    password,
  },
});

export const getOAuthSignInUrl = ({ provider = 'google', redirectTo } = {}) => {
  const { authUrl, key } = getSupabaseConfig();
  const url = new URL(`${authUrl}/authorize`);
  url.searchParams.set('apikey', key);
  url.searchParams.set('provider', provider);

  if (redirectTo) {
    url.searchParams.set('redirect_to', redirectTo);
  }

  return url.href;
};

export const refreshSession = (refreshToken) => supabaseAuthRequest('/token?grant_type=refresh_token', {
  body: {
    refresh_token: refreshToken,
  },
});

export const getSupabaseUser = (token) => supabaseAuthRequest('/user', { token });

export const updateCurrentSupabaseUser = (token, body) => supabaseAuthRequest('/user', {
  body,
  method: 'PUT',
  token,
});

export const getSupabaseAuthUserById = async (userId) => {
  const data = await supabaseAuthAdminRequest(`/admin/users/${encodeURIComponent(userId)}`);

  return data?.user || data;
};

export const updateSupabaseAuthUserById = async (userId, body) => {
  const data = await supabaseAuthAdminRequest(`/admin/users/${encodeURIComponent(userId)}`, {
    body,
    method: 'PUT',
  });

  return data?.user || data;
};

export const signOut = (token) => supabaseAuthRequest('/logout', { method: 'POST', token });
