import { fail, ok, requestId } from '@/lib/api-response';
import { loginWithWechatCode } from '@/lib/server/auth';
import { maybeEnqueueProfileRewrite } from '@/lib/server/auth-profile-rewrite';
import { logAuthEvent } from '@/lib/server/auth-log';
import { checkRateLimit, clientIp } from '@/lib/server/rate-limit';
import { z } from 'zod';

const bodySchema = z.object({
  code: z.string().trim().min(4).max(128),
});

export async function POST(request: Request) {
  const started = Date.now();
  const reqId = requestId();
  const ip = clientIp(request);
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail('BAD_REQUEST', '微信登录参数无效', parsed.error.flatten());
  }

  const ipLimit = checkRateLimit(`auth:wechat:ip:${ip}`, 30, 15 * 60 * 1000);
  if (!ipLimit.ok) {
    return fail('RATE_LIMITED', `登录尝试过于频繁，请 ${ipLimit.retryAfterSec} 秒后再试。`, undefined, 429);
  }

  try {
    const { user, sessionToken, isNewUser } = await loginWithWechatCode(parsed.data.code);
    void maybeEnqueueProfileRewrite(user.familyId, user.childId);
    logAuthEvent('wechat_login', { requestId: reqId, ip, outcome: 'ok', durationMs: Date.now() - started });
    return ok({ user, sessionToken, isNewUser }, reqId);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'AUTH_FAILED';
    logAuthEvent('wechat_login', { requestId: reqId, ip, outcome: code, durationMs: Date.now() - started });
    if (code === 'WECHAT_NOT_CONFIGURED' || code === 'WECHAT_INVALID_SECRET') {
      return fail(
        'WECHAT_NOT_CONFIGURED',
        '服务端 AppSecret 未配置或填写错误，请在微信公众平台「开发设置」复制 AppSecret 后更新服务器 WECHAT_SECRET。',
        undefined,
        503
      );
    }
    if (code.startsWith('WECHAT_CODE_INVALID')) {
      return fail('WECHAT_CODE_INVALID', '微信登录已过期，请重试。', undefined, 401);
    }
    if (code === 'AUTH_DATABASE_DISABLED') {
      return fail('AUTH_DATABASE_DISABLED', '数据库未连接。', undefined, 503);
    }
    return fail('AUTH_FAILED', '微信登录失败，请稍后再试。', undefined, 500);
  }
}
