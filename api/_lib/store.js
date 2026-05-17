const memoryUsers = globalThis.__pbFinanceAuthUsers || new Map();
globalThis.__pbFinanceAuthUsers = memoryUsers;

const redisUrl = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.replace(/\/$/, '');
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const isRedisConfigured = () => Boolean(redisUrl && redisToken);

const assertProductionStore = () => {
  if (process.env.NODE_ENV === 'production' && !isRedisConfigured()) {
    throw new Error('Configure Upstash Redis env vars for production auth.');
  }
};

const redisCommand = async (...parts) => {
  const response = await fetch(`${redisUrl}/${parts.map((part) => encodeURIComponent(part)).join('/')}`, {
    headers: {
      Authorization: `Bearer ${redisToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to reach user store.');
  }

  const data = await response.json();
  return data.result;
};

const userKey = (email) => `pb:auth:user:${email}`;

export const getUserByEmail = async (email) => {
  assertProductionStore();

  if (!isRedisConfigured()) {
    return memoryUsers.get(email) || null;
  }

  const value = await redisCommand('GET', userKey(email));
  return value ? JSON.parse(value) : null;
};

export const saveUser = async (user) => {
  assertProductionStore();

  if (!isRedisConfigured()) {
    memoryUsers.set(user.email, user);
    return user;
  }

  await redisCommand('SET', userKey(user.email), JSON.stringify(user));
  return user;
};

export const getStoreMode = () => (isRedisConfigured() ? 'redis' : 'memory');
