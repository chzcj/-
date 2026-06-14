import 'server-only';

import { cookies } from 'next/headers';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import {
  createAuthSession,
  createUser,
  deleteAuthSession,
  findUserByPhone,
  findUserBySessionTokenHash,
  isDatabaseEnabled,
  type UserRecord
} from '@/lib/server/db';

const COOKIE_NAME = 'childos_session';
const SESSION_DAYS = 30;
const DEMO_SESSION_TOKEN = 'childos_demo_session';

export interface AuthUser {
  userId: string;
  phone: string;
  familyId: string;
  childId: string;
}

export function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '').trim();
}

export async function registerWithPhonePassword(phoneInput: string, password: string) {
  requireAuthDatabase();
  const phone = normalizePhone(phoneInput);
  validateCredentials(phone, password);
  const existing = await findUserByPhone(phone);
  if (existing) throw new Error('PHONE_EXISTS');
  const user = await createUser(phone, hashPassword(password));
  if (!user) throw new Error('AUTH_DATABASE_UNAVAILABLE');
  await setLoginSession(user);
  return publicUser(user);
}

export async function loginWithPhonePassword(phoneInput: string, password: string) {
  requireAuthDatabase();
  const phone = normalizePhone(phoneInput);
  validateCredentials(phone, password);
  const user = await findUserByPhone(phone);
  if (!user || !verifyPassword(password, user.passwordHash)) throw new Error('BAD_CREDENTIALS');
  await setLoginSession(user);
  return publicUser(user);
}

export async function logoutCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token && token !== DEMO_SESSION_TOKEN) {
    await deleteAuthSession(hashToken(token)).catch((error) => {
      console.error('[childos] delete auth session failed', error);
    });
  }
  cookies().delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<AuthUser | undefined> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return undefined;
  if (token === DEMO_SESSION_TOKEN) return demoUser();
  const user = await findUserBySessionTokenHash(hashToken(token)).catch((error) => {
    console.error('[childos] get current user failed', error);
    return undefined;
  });
  return user ? publicUser(user) : undefined;
}

export async function loginAsDemoUser() {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  cookies().set(COOKIE_NAME, DEMO_SESSION_TOKEN, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.AUTH_COOKIE_SECURE === 'true',
    path: '/',
    expires: expiresAt
  });
  return demoUser();
}

export async function getRequestIdentity(defaults = { familyId: 'f_demo', childId: 'c_demo' }) {
  const user = await getCurrentUser();
  if (!user) return defaults;
  return { familyId: user.familyId, childId: user.childId };
}

function requireAuthDatabase() {
  if (!isDatabaseEnabled()) throw new Error('AUTH_DATABASE_DISABLED');
}

function validateCredentials(phone: string, password: string) {
  if (!/^(\+?\d{8,16})$/.test(phone)) throw new Error('BAD_PHONE');
  if (password.length < 8 || password.length > 72) throw new Error('BAD_PASSWORD');
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}

function verifyPassword(password: string, stored: string) {
  const [scheme, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function setLoginSession(user: UserRecord) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await createAuthSession(user.userId, hashToken(token), expiresAt);
  const secureCookie =
    process.env.AUTH_COOKIE_SECURE === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.AUTH_COOKIE_SECURE !== 'false');
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    path: '/',
    expires: expiresAt
  });
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user: UserRecord): AuthUser {
  return {
    userId: user.userId,
    phone: user.phone,
    familyId: user.familyId,
    childId: user.childId
  };
}

function demoUser(): AuthUser {
  return {
    userId: 'demo_user',
    phone: '13800002641',
    familyId: 'f_demo',
    childId: 'c_demo'
  };
}
