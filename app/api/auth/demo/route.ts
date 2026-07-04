import { fail, ok } from '@/lib/api-response';
import { isDemoLoginEnabled, loginAsDemoUser } from '@/lib/server/auth';

export async function POST() {
  if (!isDemoLoginEnabled()) {
    return fail('DEMO_DISABLED', '演示模式未开放，请使用手机号登录。', undefined, 403);
  }
  const user = await loginAsDemoUser();
  return ok({ user });
}
