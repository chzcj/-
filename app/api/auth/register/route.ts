import { fail, ok } from '@/lib/api-response';
import { authCredentialsSchema } from '@/lib/schemas';
import { registerWithPhonePassword } from '@/lib/server/auth';
import { checkRateLimit, clientIp } from '@/lib/server/rate-limit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = authCredentialsSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '手机号或密码格式不对，请再检查一下。', parsed.error.flatten());

  const ip = clientIp(request);
  const ipLimit = checkRateLimit(`auth:register:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!ipLimit.ok) {
    return fail('RATE_LIMITED', `注册尝试过于频繁，请 ${ipLimit.retryAfterSec} 秒后再试。`, undefined, 429);
  }

  try {
    const user = await registerWithPhonePassword(parsed.data.phone, parsed.data.password);
    return ok({ user });
  } catch (error) {
    return failAuth(error);
  }
}

function failAuth(error: unknown) {
  const code = error instanceof Error ? error.message : 'AUTH_FAILED';
  if (code === 'PHONE_EXISTS') return fail('PHONE_EXISTS', '这个手机号已经注册过，可以直接登录。', undefined, 409);
  if (code === 'BAD_PHONE') return fail('BAD_PHONE', '手机号格式不对，请再检查一下。');
  if (code === 'BAD_PASSWORD') return fail('BAD_PASSWORD', '密码至少需要 8 位。');
  if (code === 'AUTH_DATABASE_DISABLED') {
    return fail('AUTH_DATABASE_DISABLED', '数据库未连接，可先使用演示模式浏览。', undefined, 503);
  }
  if (isDatabaseConnectionError(error)) {
    return fail('AUTH_DATABASE_DISABLED', '数据库未连接，可先使用演示模式浏览。', undefined, 503);
  }
  return fail('AUTH_FAILED', '注册暂时没有成功，可以稍后再试。', undefined, 500);
}

function isDatabaseConnectionError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return true;
  const message = String(err.message || '');
  return message.includes('ECONNREFUSED') || message.includes('connect ETIMEDOUT');
}
