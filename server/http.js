const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

export const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
    return req.body ? JSON.parse(req.body) : {};
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
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
