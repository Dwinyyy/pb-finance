import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = 'sha512';

const getAuthSecret = () => {
  const secret = process.env.AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production.');
  }

  return 'pb-finance-local-development-secret';
};

const toBase64Url = (value) => Buffer.from(value).toString('base64url');
const fromBase64Url = (value) => Buffer.from(value, 'base64url').toString('utf8');

const sign = (value) => createHmac('sha256', getAuthSecret()).update(value).digest('base64url');

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const publicUser = (user) => ({
  company: user.company || '',
  email: user.email,
  id: user.id,
  name: user.name,
  role: user.role,
  title: user.title || '',
});

export const hashPassword = (password) => {
  const salt = randomBytes(16).toString('base64url');
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString('base64url');

  return {
    passwordHash: hash,
    passwordSalt: salt,
  };
};

export const verifyPassword = (password, user) => {
  if (!password || !user?.passwordHash || !user?.passwordSalt) {
    return false;
  }

  const expected = Buffer.from(user.passwordHash, 'base64url');
  const actual = pbkdf2Sync(password, user.passwordSalt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
};

export const createToken = (user) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    email: user.email,
    exp: now + TOKEN_TTL_SECONDS,
    iat: now,
    role: user.role,
    sub: user.id,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const signature = sign(body);

  return `${body}.${signature}`;
};

export const verifyToken = (token) => {
  const [body, signature] = String(token || '').split('.');

  if (!body || !signature || sign(body) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(body));

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const getBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const [scheme, token] = String(header).split(' ');

  return scheme?.toLowerCase() === 'bearer' ? token : '';
};
