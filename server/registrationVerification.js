import crypto from 'node:crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { createClient } from 'redis';

import { sendRegistrationOtpEmail } from './notifications.js';
import { normalizeEmail } from './supabase.js';

const OTP_TTL_SECONDS = 10 * 60;
const MAX_OTP_ATTEMPTS = 5;
const TOKEN_ISSUER = 'pb-finance';
const TOKEN_AUDIENCE = 'registration';

let redisClientPromise;

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const cleanString = (value, maxLength = 500) => String(value || '').trim().slice(0, maxLength);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const symbolPattern = /[^A-Za-z0-9]/;

const getRedisUrl = () => process.env.REDIS_URL || process.env.KV_URL || '';

const getRedisClient = async () => {
  const url = getRedisUrl();

  if (!url) {
    throw createHttpError(500, 'Redis is not configured. Set REDIS_URL before enabling registration verification.');
  }

  if (!redisClientPromise) {
    const client = createClient({ url });
    client.on('error', () => undefined);
    redisClientPromise = client.connect()
      .then(() => client)
      .catch((error) => {
        redisClientPromise = null;
        throw error;
      });
  }

  return redisClientPromise;
};

const getJwtSecret = () => {
  const secret = process.env.REGISTRATION_JWT_SECRET
    || process.env.AUTH_JWT_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || '';

  if (secret.length < 32) {
    throw createHttpError(500, 'REGISTRATION_JWT_SECRET must be set to at least 32 characters.');
  }

  return crypto.createHash('sha256').update(secret).digest();
};

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const pendingKey = (jti) => `pb:registration:${jti}`;
const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
const hashOtp = (otp, salt) => sha256(`${salt}:${otp}`);

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getPasswordRequirementError = (password) => {
  const value = String(password || '');

  if (value.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !symbolPattern.test(value)) {
    return 'Password must include lowercase, uppercase, a number, and a symbol.';
  }

  return '';
};

const normalizeRegistrationPayload = (body) => {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const role = body.role === 'professional' ? 'professional' : 'client';
  const payload = {
    company: cleanString(body.company, 180),
    email,
    fullName: cleanString(body.fullName, 180),
    password,
    redirectTo: cleanString(body.redirectTo, 500),
    role,
  };

  if (!emailPattern.test(email)) {
    throw createHttpError(400, 'A valid email is required.');
  }

  const passwordError = getPasswordRequirementError(password);

  if (passwordError) {
    throw createHttpError(400, passwordError);
  }

  if (!payload.fullName) {
    throw createHttpError(400, 'Full name is required.');
  }

  if (role === 'client' && !payload.company) {
    throw createHttpError(400, 'Company is required.');
  }

  return payload;
};

const encryptRegistrationToken = (payload) => (
  new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setExpirationTime(`${OTP_TTL_SECONDS}s`)
    .setJti(payload.jti)
    .setSubject(payload.email)
    .encrypt(getJwtSecret())
);

const decryptRegistrationToken = async (token) => {
  try {
    const { payload } = await jwtDecrypt(token, getJwtSecret(), {
      audience: TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
    });

    if (payload.purpose !== TOKEN_AUDIENCE || !payload.jti || !payload.email) {
      throw createHttpError(400, 'Invalid registration token.');
    }

    return payload;
  } catch (error) {
    if (error.status) throw error;
    throw createHttpError(400, 'Registration verification expired. Please request a new code.');
  }
};

const savePendingRecord = async (record) => {
  const client = await getRedisClient();
  const ttl = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
  await client.set(pendingKey(record.jti), JSON.stringify(record), { EX: ttl });
};

const readPendingRecord = async (jti) => {
  const client = await getRedisClient();
  const raw = await client.get(pendingKey(jti));

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    await client.del(pendingKey(jti));
    return null;
  }
};

const deletePendingRecord = async (jti) => {
  const client = await getRedisClient();
  await client.del(pendingKey(jti));
};

export const requestRegistrationVerification = async (body) => {
  const registration = normalizeRegistrationPayload(body);
  const otp = generateOtp();
  const otpSalt = crypto.randomBytes(16).toString('hex');
  const jti = crypto.randomUUID();
  const expiresAt = Date.now() + (OTP_TTL_SECONDS * 1000);
  const tokenPayload = {
    ...registration,
    jti,
    otpHash: hashOtp(otp, otpSalt),
    otpSalt,
    purpose: TOKEN_AUDIENCE,
  };
  const verificationToken = await encryptRegistrationToken(tokenPayload);
  const record = {
    attempts: 0,
    email: registration.email,
    expiresAt,
    jti,
    otpHash: tokenPayload.otpHash,
    otpSalt,
    payloadToken: verificationToken,
    role: registration.role,
    tokenHash: sha256(verificationToken),
  };

  await savePendingRecord(record);

  try {
    await sendRegistrationOtpEmail({
      email: registration.email,
      name: registration.fullName,
      otp,
    });
  } catch (error) {
    await deletePendingRecord(jti);
    throw error;
  }

  return {
    email: registration.email,
    expiresIn: OTP_TTL_SECONDS,
    requiresOtpVerification: true,
    verificationToken,
  };
};

export const verifyRegistrationOtp = async ({ otp, verificationToken }) => {
  const token = cleanString(verificationToken, 5000);
  const submittedOtp = cleanString(otp, 10);

  if (!token || !/^\d{6}$/.test(submittedOtp)) {
    throw createHttpError(400, 'A valid 6-digit verification code is required.');
  }

  const payload = await decryptRegistrationToken(token);
  const record = await readPendingRecord(payload.jti);

  if (!record || Date.now() > Number(record.expiresAt || 0)) {
    throw createHttpError(400, 'Registration verification expired. Please request a new code.');
  }

  if (!safeEqual(record.tokenHash, sha256(token)) || !safeEqual(record.email, payload.email)) {
    throw createHttpError(400, 'Invalid registration token.');
  }

  if (Number(record.attempts || 0) >= MAX_OTP_ATTEMPTS) {
    await deletePendingRecord(payload.jti);
    throw createHttpError(429, 'Too many invalid verification attempts. Please request a new code.');
  }

  if (!safeEqual(record.otpHash, hashOtp(submittedOtp, record.otpSalt))) {
    const nextRecord = {
      ...record,
      attempts: Number(record.attempts || 0) + 1,
    };

    if (nextRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await deletePendingRecord(payload.jti);
      throw createHttpError(429, 'Too many invalid verification attempts. Please request a new code.');
    }

    await savePendingRecord(nextRecord);
    throw createHttpError(400, 'Verification code is incorrect.');
  }

  await deletePendingRecord(payload.jti);

  return {
    company: cleanString(payload.company, 180),
    email: normalizeEmail(payload.email),
    fullName: cleanString(payload.fullName, 180),
    password: String(payload.password || ''),
    redirectTo: cleanString(payload.redirectTo, 500),
    role: payload.role === 'professional' ? 'professional' : 'client',
  };
};
