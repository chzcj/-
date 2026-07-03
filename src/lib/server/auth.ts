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
  isUserDeleted,
  restoreUser,
  setUserAdminByPhone,
  updateUserPassword,
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
  isAdmin: boolean;
  onboardingComplete: boolean;
}

// 管理员手机号白名单（声明式）：登录/注册时把名单内的号落库 is_admin=true。
function adminPhones(): string[] {
  return (process.env.ADMIN_PHONES || '').split(',').map((s) => normalizePhone(s)).filter(Boolean);
}
function isAdminPhone(phone: string): boolean {
  return adminPhones().includes(normalizePhone(phone));
}
async function maybePromoteAdmin(user: UserRecord): Promise<void> {
  if (isAdminPhone(user.phone) && !user.isAdmin) {
    await setUserAdminByPhone(user.phone, true).catch((err) => console.error('[auth] 同步管理员标记失败', err));
  }
}

export function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '').trim();
}

/** 生产环境默认关闭 demo 登录；开发环境始终开放。 */
export function isDemoLoginEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.DEMO_LOGIN_ENABLED === 'true';
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
  await maybePromoteAdmin(user);
  return publicUser(user);
}

export async function loginWithPhonePassword(phoneInput: string, password: string) {
  requireAuthDatabase();
  const phone = normalizePhone(phoneInput);
  validateCredentials(phone, password);
  const user = await findUserByPhone(phone);
  if (!user || !verifyPassword(password, user.passwordHash)) throw new Error('BAD_CREDENTIALS');
  // 注销账号 30 天恢复期：重新登录即恢复（清除 deleted_at）。
  if (await isUserDeleted(user.userId)) {
    await restoreUser(user.userId).catch((err) => console.error('[auth] 恢复已注销账号失败', err));
  }
  await setLoginSession(user);
  await maybePromoteAdmin(user);
  return publicUser(user);
}

/** 修改密码：验证旧密码后更新。 */
export async function changeUserPassword(userId: string, phone: string, oldPassword: string, newPassword: string): Promise<void> {
  requireAuthDatabase();
  const normalizedPhone = normalizePhone(phone);
  validateCredentials(normalizedPhone, newPassword);
  const user = await findUserByPhone(normalizedPhone);
  if (!user || user.userId !== userId) throw new Error('USER_NOT_FOUND');
  if (!verifyPassword(oldPassword, user.passwordHash)) throw new Error('BAD_CREDENTIALS');
  await updateUserPassword(userId, hashPassword(newPassword));
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
    childId: user.childId,
    isAdmin: user.isAdmin || isAdminPhone(user.phone),
    onboardingComplete: user.onboardingComplete === true
  };
}

function demoUser(): AuthUser {
  return {
    userId: 'demo_user',
    phone: '13800002641',
    familyId: 'f_demo',
    childId: 'c_demo',
    // Demo 会话永无管理员权限，避免公开 demo 接口被滥用提权。
    isAdmin: false,
    onboardingComplete: false
  };
}
