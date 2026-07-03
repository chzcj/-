import { fail, ok } from '@/lib/api-response';
import { changeUserPassword, getCurrentUser } from '@/lib/server/auth';
import { checkRateLimit, clientIp } from '@/lib/server/rate-limit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { oldPassword, newPassword } = body as { oldPassword?: string; newPassword?: string };
  if (!oldPassword || !newPassword) return fail('BAD_REQUEST', '请填写旧密码与新密码。');

  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHORIZED', '请先登录。', undefined, 401);

  const ip = clientIp(request);
  const limit = checkRateLimit(`auth:changepwd:${user.userId}:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return fail('RATE_LIMITED', `操作过于频繁，请 ${limit.retryAfterSec} 秒后再试。`, undefined, 429);
  }

  try {
    await changeUserPassword(user.userId, user.phone, oldPassword, newPassword);
    return ok({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CHANGE_FAILED';
    if (code === 'BAD_CREDENTIALS') return fail('BAD_CREDENTIALS', '旧密码不正确。', undefined, 401);
    if (code === 'BAD_PASSWORD') return fail('BAD_PASSWORD', '新密码至少需要 8 位，不超过 72 位。');
    if (code === 'USER_NOT_FOUND') return fail('USER_NOT_FOUND', '账号不存在。', undefined, 404);
    return fail('CHANGE_FAILED', '修改失败，请稍后再试。', undefined, 500);
  }
}
