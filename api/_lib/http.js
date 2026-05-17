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

export const requireMethod = (req, res, methods) => {
  if (methods.includes(req.method)) {
    return true;
  }

  res.setHeader('Allow', methods.join(', '));
  sendError(res, 405, 'Method not allowed.');
  return false;
};
