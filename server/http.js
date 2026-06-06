const allowedOrigin = process.env.ALLOWED_ORIGIN || process.env.PUBLIC_APP_URL || 'http://localhost:5173';

export const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, GET, PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-src 'none'; object-src 'none'");
};

export const handleOptions = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
};

export const sendJson = (res, status, body) => {
  setCorsHeaders(res);
  res.status(status).json(body);
};

export const sendError = (res, status, message) => {
  sendJson(res, status, { error: message });
};

export const readJson = async (req) => {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    try {
      return req.body ? JSON.parse(req.body) : {};
    } catch {
      throw new Error('Invalid JSON payload');
    }
  }

  const chunks = [];
  let length = 0;

  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024 * 5) { // 5MB limit
      throw new Error('Payload too large');
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('Invalid JSON payload');
  }
};

export const getRoutePath = (req) => {
  const queryPath = Array.isArray(req.query?.path) ? req.query.path.join('/') : req.query?.path;

  if (queryPath) {
    return `/${String(queryPath).replace(/^\/+/, '').replace(/\/+$/, '')}`;
  }

  const url = new URL(req.url || '/api', `https://${req.headers.host || 'localhost'}`);
  const searchPath = url.searchParams.get('path');

  if (searchPath) {
    return `/${searchPath.replace(/^\/+/, '').replace(/\/+$/, '')}`;
  }

  const withoutApiPrefix = url.pathname.replace(/^\/api/, '') || '/';
  return withoutApiPrefix.replace(/\/+$/, '') || '/';
};
