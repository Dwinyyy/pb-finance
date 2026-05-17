import { randomUUID } from 'node:crypto';
import { createToken, hashPassword, normalizeEmail, publicUser } from '../_lib/auth.js';
import { handleOptions, readJson, requireMethod, sendError, sendJson } from '../_lib/http.js';
import { getStoreMode, getUserByEmail, saveUser } from '../_lib/store.js';

const getDisplayName = (email) => email.split('@')[0].replace(/[._-]+/g, ' ') || 'PB Finance User';

export default async function handler(req, res) {
  if (handleOptions(req, res) || !requireMethod(req, res, ['POST'])) return;

  try {
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const role = body.role === 'professional' ? 'professional' : 'client';

    if (!email || !email.includes('@')) {
      sendError(res, 400, 'A valid work email is required.');
      return;
    }

    if (password.length < 8) {
      sendError(res, 400, 'Password must be at least 8 characters.');
      return;
    }

    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      sendError(res, 409, 'An account already exists for this email.');
      return;
    }

    const user = {
      ...hashPassword(password),
      company: String(body.company || '').trim(),
      createdAt: new Date().toISOString(),
      email,
      id: randomUUID(),
      name: String(body.fullName || '').trim() || getDisplayName(email),
      role,
      title: role === 'professional' ? 'Complete your profile' : '',
    };

    await saveUser(user);

    sendJson(res, 201, {
      storeMode: getStoreMode(),
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    sendError(res, 500, error.message || 'Unable to create account.');
  }
}
