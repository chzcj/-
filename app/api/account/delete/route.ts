import { fail, ok } from '@/lib/api-response';
import { getCurrentUser, logoutCurrentUser } from '@/lib/server/auth';
import { markUserDeleted } from '@/lib/server/db';
import { checkRateLimit, clientIp } from '@/lib/server/rate-limit';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { confirm } = body as { confirm?: string };
  if (confirm !== '确认注销') return fail('BAD_REQUEST', '请输入"确认注销"以继续。');

  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHORIZED', '请先登录。', undefined, 401);

  const ip = clientIp(request);
  const limit = checkRateLimit(`auth:delete:${user.userId}:${ip}`, 3, 60 * 60 * 1000);
  if (!limit.ok) {
    return fail('RATE_LIMITED', `操作过于频繁，请 ${limit.retryAfterSec} 秒后再试。`, undefined, 429);
  }

  try {
    // 软删除：标记 deleted_at，30 天内重新登录可恢复。
    await markUserDeleted(user.userId);
    await logoutCurrentUser();
    return ok({ ok: true, recoverableDays: 30 });
  } catch (error) {
    console.error('[account/delete] 注销失败', error);
    return fail('DELETE_FAILED', '注销失败，请稍后再试。', undefined, 500);
  }
}
