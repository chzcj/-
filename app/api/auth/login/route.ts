import { fail, ok, requestId } from '@/lib/api-response';
import { authCredentialsSchema } from '@/lib/schemas';
import { loginWithPhonePassword } from '@/lib/server/auth';
import { logAuthEvent } from '@/lib/server/auth-log';
import { checkRateLimit, clientIp } from '@/lib/server/rate-limit';
import { getLatestBuiltProfileSnapshot } from '@/lib/server/memory/database-manager';
import { enqueueJob, profileRewriteBucketKey } from '@/lib/server/jobs/queue';
import type { TenantId } from '@/lib/server/memory/tenant';

const PROFILE_REWRITE_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000 // 2 天

/** 登录后检查画像是否超过 2 天未更新，是则入队后台重写（静默，不阻塞登录）。 */
async function maybeEnqueueProfileRewrite(familyId: string, childId: string): Promise<void> {
  try {
    const tenant: TenantId = { familyId, childId }
    const built = await getLatestBuiltProfileSnapshot(tenant)
    if (!built) return // 还没首次建模，不重写
    const ageMs = Date.now() - new Date(built.updatedAt).getTime()
    if (ageMs < PROFILE_REWRITE_INTERVAL_MS) return // 不到 2 天，跳过
    await enqueueJob('profile_rewrite', { tenant }, profileRewriteBucketKey(tenant), null)
  } catch (err) {
    console.error('[login] 入队 profile_rewrite 失败（不影响登录）', err)
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  const reqId = requestId();
  const body = await request.json().catch(() => ({}));
  const parsed = authCredentialsSchema.safeParse(body);
  if (!parsed.success) {
    logAuthEvent('login', { requestId: reqId, ip: clientIp(request), outcome: 'bad_request' });
    return fail('BAD_REQUEST', '手机号或密码格式不对，请再检查一下。', parsed.error.flatten());
  }

  const ip = clientIp(request);
  const phone = parsed.data.phone.replace(/[^\d+]/g, '').trim();
  const ipLimit = checkRateLimit(`auth:login:ip:${ip}`, 30, 15 * 60 * 1000);
  if (!ipLimit.ok) {
    logAuthEvent('login', { requestId: reqId, ip, phone, outcome: 'rate_limited', durationMs: Date.now() - started });
    return fail('RATE_LIMITED', `登录尝试过于频繁，请 ${ipLimit.retryAfterSec} 秒后再试。`, undefined, 429);
  }
  const phoneLimit = checkRateLimit(`auth:login:phone:${phone}`, 10, 15 * 60 * 1000);
  if (!phoneLimit.ok) {
    logAuthEvent('login', { requestId: reqId, ip, phone, outcome: 'rate_limited', durationMs: Date.now() - started });
    return fail('RATE_LIMITED', `该账号登录尝试过于频繁，请 ${phoneLimit.retryAfterSec} 秒后再试。`, undefined, 429);
  }

  try {
    const user = await loginWithPhonePassword(parsed.data.phone, parsed.data.password);
    void maybeEnqueueProfileRewrite(user.familyId, user.childId);
    logAuthEvent('login', { requestId: reqId, ip, phone, outcome: 'ok', durationMs: Date.now() - started });
    return ok({ user }, reqId);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'AUTH_FAILED';
    logAuthEvent('login', { requestId: reqId, ip, phone, outcome: code, durationMs: Date.now() - started, error: String(error) });
    return failAuth(error);
  }
}

function failAuth(error: unknown) {
  const code = error instanceof Error ? error.message : 'AUTH_FAILED';
  if (code === 'BAD_CREDENTIALS') return fail('BAD_CREDENTIALS', '手机号或密码不正确。', undefined, 401);
  if (code === 'BAD_PHONE') return fail('BAD_PHONE', '手机号格式不对，请再检查一下。');
  if (code === 'BAD_PASSWORD') return fail('BAD_PASSWORD', '密码至少需要 8 位。');
  if (code === 'AUTH_DATABASE_DISABLED') {
    return fail('AUTH_DATABASE_DISABLED', '数据库未连接，可先使用演示模式浏览。', undefined, 503);
  }
  if (code === 'AUTH_DATABASE_UNAVAILABLE') {
    return fail('AUTH_DATABASE_UNAVAILABLE', '数据库暂时不可用，可先使用演示模式浏览。', undefined, 503);
  }
  if (isDatabaseConnectionError(error)) {
    return fail('AUTH_DATABASE_DISABLED', '数据库未连接，可先使用演示模式浏览。', undefined, 503);
  }
  return fail('AUTH_FAILED', '登录暂时没有成功，可以稍后再试。', undefined, 500);
}

function isDatabaseConnectionError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return true;
  const message = String(err.message || '');
  return message.includes('ECONNREFUSED') || message.includes('connect ETIMEDOUT');
}
