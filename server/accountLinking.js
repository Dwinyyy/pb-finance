import crypto from 'node:crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { createClient } from 'redis';

import {
  finalizeOAuthAccount,
  getAuthProviders,
  hasAuthProvider,
  markGoogleLinkVerified,
} from './authTriage.js';
import { sendRegistrationOtpEmail } from './notifications.js';
import {
  getSupabaseAuthUserById,
  getSupabaseUser,
  normalizeEmail,
  publicUser,
  signInWithPassword,
  supabaseRestRequest,
  updateCurrentSupabaseUser,
} from './supabase.js';

const OTP_TTL_SECONDS = 10 * 60;
const MAX_OTP_ATTEMPTS = 5;
const TOKEN_ISSUER = 'pb-finance';
const TOKEN_AUDIENCE = 'account-link';
const GOOGLE_LINK_PURPOSE = 'google_password_link';
const PASSWORD_SETUP_PURPOSE = 'password_setup';
const PASSWORD_SETUP_CONFIRMED_PURPOSE = 'password_setup_confirmed';

let redisClientPromise;

const asList = (value) => (Array.isArray(value) ? value : []);
const cleanString = (value, maxLength = 500) => String(value || '').trim().slice(0, maxLength);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const symbolPattern = /[^A-Za-z0-9]/;

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const requireServiceRole = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw createHttpError(500, 'SUPABASE_SERVICE_ROLE_KEY is required for account linking.');
  }
};

const getRedisUrl = () => process.env.REDIS_URL || process.env.KV_URL || '';

const getRedisClient = async () => {
  const url = getRedisUrl();

  if (!url) {
    throw createHttpError(500, 'Redis is not configured. Set REDIS_URL before enabling account linking verification.');
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
const pendingKey = (jti) => `pb:account-link:${jti}`;
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

const encryptChallengeToken = (payload) => (
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

const decryptChallengeToken = async (token, expectedPurpose) => {
  try {
    const { payload } = await jwtDecrypt(token, getJwtSecret(), {
      audience: TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
    });

    if (payload.purpose !== expectedPurpose || !payload.jti || !payload.email) {
      throw createHttpError(400, 'Invalid verification token.');
    }

    return payload;
  } catch (error) {
    if (error.status) throw error;
    throw createHttpError(400, 'Verification expired. Please request a new code.');
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

const requestOtpChallenge = async ({ email, name, payload, purpose }) => {
  const normalizedEmail = normalizeEmail(email);
  const otp = generateOtp();
  const otpSalt = crypto.randomBytes(16).toString('hex');
  const jti = crypto.randomUUID();
  const expiresAt = Date.now() + (OTP_TTL_SECONDS * 1000);
  const tokenPayload = {
    ...payload,
    email: normalizedEmail,
    jti,
    otpHash: hashOtp(otp, otpSalt),
    otpSalt,
    purpose,
  };
  const verificationToken = await encryptChallengeToken(tokenPayload);

  await savePendingRecord({
    attempts: 0,
    email: normalizedEmail,
    expiresAt,
    jti,
    otpHash: tokenPayload.otpHash,
    otpSalt,
    purpose,
    tokenHash: sha256(verificationToken),
  });

  try {
    await sendRegistrationOtpEmail({
      email: normalizedEmail,
      name,
      otp,
    });
  } catch (error) {
    await deletePendingRecord(jti);
    throw error;
  }

  return {
    email: normalizedEmail,
    expiresIn: OTP_TTL_SECONDS,
    requiresOtpVerification: true,
    verificationToken,
  };
};

const verifyOtpChallenge = async ({ expectedPurpose, otp, verificationToken }) => {
  const token = cleanString(verificationToken, 5000);
  const submittedOtp = cleanString(otp, 10);

  if (!token || !/^\d{6}$/.test(submittedOtp)) {
    throw createHttpError(400, 'A valid 6-digit verification code is required.');
  }

  const payload = await decryptChallengeToken(token, expectedPurpose);
  const record = await readPendingRecord(payload.jti);

  if (!record || Date.now() > Number(record.expiresAt || 0)) {
    throw createHttpError(400, 'Verification expired. Please request a new code.');
  }

  if (
    record.purpose !== expectedPurpose
    || !safeEqual(record.tokenHash, sha256(token))
    || !safeEqual(record.email, payload.email)
  ) {
    throw createHttpError(400, 'Invalid verification token.');
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
  return payload;
};

const readProfileByEmail = async (email) => {
  requireServiceRole();

  const normalizedEmail = normalizeEmail(email);
  const path = `/profiles?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email,full_name,company,role,title,client_tier,google_link_verified_at,password_login_enabled_at&limit=1`;
  let rows;

  try {
    rows = await supabaseRestRequest(path, { useServiceRole: true });
  } catch (error) {
    if (!String(error.message || '').includes('google_link_verified_at')
      && !String(error.message || '').includes('password_login_enabled_at')
      && !String(error.message || '').includes('client_tier')) {
      throw error;
    }

    rows = await supabaseRestRequest(
      `/profiles?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email,full_name,company,role,title&limit=1`,
      { useServiceRole: true }
    );
  }

  return asList(rows)[0] || null;
};

const patchProfileLinkState = async (userId, body) => {
  if (!userId) return;

  await supabaseRestRequest(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
    body,
    method: 'PATCH',
    prefer: 'return=minimal',
    useServiceRole: true,
  }).catch(() => undefined);
};

const userFromProfile = (authUser, profile) => {
  const base = publicUser(authUser);

  if (!profile) return base;

  return {
    ...base,
    company: profile.company || base.company,
    email: profile.email || base.email,
    name: profile.full_name || base.name,
    role: profile.role || base.role,
    clientTier: profile.client_tier || base.clientTier,
    client_tier: profile.client_tier || base.client_tier,
    title: profile.title || base.title,
  };
};

export const getPasswordSetupRequirement = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!emailPattern.test(normalizedEmail)) {
    return {
      requiresPasswordSetup: false,
    };
  }

  const profile = await readProfileByEmail(normalizedEmail);

  if (!profile?.id) {
    return {
      requiresPasswordSetup: false,
    };
  }

  if (profile.password_login_enabled_at) {
    return {
      requiresPasswordSetup: false,
    };
  }

  const authUser = await getSupabaseAuthUserById(profile.id);
  const providers = getAuthProviders(authUser);
  const hasGoogle = providers.includes('google');
  const hasEmailPassword = providers.includes('email');

  if (!hasGoogle || hasEmailPassword) {
    return {
      requiresPasswordSetup: false,
    };
  }

  return {
    email: normalizedEmail,
    message: `This email is already registered with Google Sign-In. Create a password and verify the email code to add email login.`,
    requiresPasswordSetup: true,
  };
};

export const requestGooglePasswordLinkVerification = async ({
  authUser,
  company = '',
  password,
  requestedRole = '',
}) => {
  const email = normalizeEmail(authUser?.email);

  if (!authUser?.id || !hasAuthProvider(authUser, 'google') || !hasAuthProvider(authUser, 'email')) {
    throw createHttpError(400, 'Google Sign-In is not ready to link for this account.');
  }

  if (!password) {
    throw createHttpError(400, 'Enter the password for the existing email account.');
  }

  let passwordSession;

  try {
    passwordSession = await signInWithPassword({ email, password });
  } catch {
    throw createHttpError(401, 'That password does not match the existing email account.');
  }

  const passwordUser = passwordSession.user || {};

  if (passwordUser.id && passwordUser.id !== authUser.id) {
    throw createHttpError(409, 'This Google account could not be matched to the existing email account. Please contact an administrator.');
  }

  return requestOtpChallenge({
    email,
    name: publicUser(authUser).name,
    payload: {
      company: cleanString(company, 180),
      requestedRole: requestedRole === 'professional' || requestedRole === 'client' ? requestedRole : '',
      userId: authUser.id,
    },
    purpose: GOOGLE_LINK_PURPOSE,
  });
};

export const verifyGooglePasswordLinkOtp = async ({
  authUser,
  otp,
  token,
  verificationToken,
}) => {
  const payload = await verifyOtpChallenge({
    expectedPurpose: GOOGLE_LINK_PURPOSE,
    otp,
    verificationToken,
  });
  const email = normalizeEmail(authUser?.email);

  if (!authUser?.id || payload.userId !== authUser.id || normalizeEmail(payload.email) !== email) {
    throw createHttpError(400, 'Verification token does not match this Google session.');
  }

  await markGoogleLinkVerified({ token, userId: authUser.id });

  const oauthResult = await finalizeOAuthAccount({
    authUser,
    company: cleanString(payload.company, 180),
    linkVerified: true,
    requestedRole: payload.requestedRole,
    token,
  });

  return {
    provider: 'supabase',
    triage: oauthResult.triage,
    user: userFromProfile(authUser, oauthResult.profile),
  };
};

export const requestPasswordSetupVerification = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const passwordError = getPasswordRequirementError(password);

  if (!emailPattern.test(normalizedEmail)) {
    throw createHttpError(400, 'A valid email is required.');
  }

  if (passwordError) {
    throw createHttpError(400, passwordError);
  }

  const requirement = await getPasswordSetupRequirement(normalizedEmail);

  if (!requirement.requiresPasswordSetup) {
    throw createHttpError(409, 'This account already has an email/password sign-in. Please log in with your password.');
  }

  const profile = await readProfileByEmail(normalizedEmail);

  return requestOtpChallenge({
    email: normalizedEmail,
    name: profile?.full_name,
    payload: {
      password,
      userId: profile.id,
    },
    purpose: PASSWORD_SETUP_PURPOSE,
  });
};

export const verifyPasswordSetupOtp = async ({ otp, verificationToken }) => {
  const payload = await verifyOtpChallenge({
    expectedPurpose: PASSWORD_SETUP_PURPOSE,
    otp,
    verificationToken,
  });
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  const passwordError = getPasswordRequirementError(password);

  if (!payload.userId || !emailPattern.test(email) || passwordError) {
    throw createHttpError(400, 'Password setup verification is invalid. Please request a new code.');
  }

  const passwordSetupToken = await encryptChallengeToken({
    email,
    jti: crypto.randomUUID(),
    password,
    purpose: PASSWORD_SETUP_CONFIRMED_PURPOSE,
    userId: payload.userId,
  });

  return {
    email,
    message: 'Email verified. Continue with Google to finish adding email/password login.',
    passwordSetupToken,
    requiresGoogleConfirmation: true,
  };
};

export const completePasswordSetupWithGoogle = async ({ passwordSetupToken, token }) => {
  const payload = await decryptChallengeToken(
    cleanString(passwordSetupToken, 5000),
    PASSWORD_SETUP_CONFIRMED_PURPOSE
  );
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  const passwordError = getPasswordRequirementError(password);
  const authUser = await getSupabaseUser(token);
  const providers = getAuthProviders(authUser);

  if (!payload.userId || !emailPattern.test(email) || passwordError) {
    throw createHttpError(400, 'Password setup confirmation is invalid. Please request a new code.');
  }

  if (authUser?.id !== payload.userId || normalizeEmail(authUser?.email) !== email || !providers.includes('google')) {
    throw createHttpError(400, 'Google Sign-In does not match the verified email account.');
  }

  const updatedAuthUser = await updateCurrentSupabaseUser(token, { password });
  const updatedProviders = getAuthProviders(updatedAuthUser);

  if (!updatedProviders.includes('email')) {
    await updateCurrentSupabaseUser(token, { email, password }).catch(() => undefined);
  }

  await patchProfileLinkState(payload.userId, {
    google_link_verified_at: new Date().toISOString(),
    password_login_enabled_at: new Date().toISOString(),
  });

  const session = await signInWithPassword({ email, password });

  return session;
};
