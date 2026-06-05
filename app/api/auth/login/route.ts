import { fail, ok } from '@/lib/api-response';
import { authCredentialsSchema } from '@/lib/schemas';
import { loginWithPhonePassword } from '@/lib/server/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = authCredentialsSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '手机号或密码格式不对，请再检查一下。', parsed.error.flatten());

  try {
    const user = await loginWithPhonePassword(parsed.data.phone, parsed.data.password);
    return ok({ user });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'AUTH_FAILED';
    if (code === 'BAD_CREDENTIALS') return fail('BAD_CREDENTIALS', '手机号或密码不正确。', undefined, 401);
    if (code === 'BAD_PHONE') return fail('BAD_PHONE', '手机号格式不对，请再检查一下。');
    if (code === 'BAD_PASSWORD') return fail('BAD_PASSWORD', '密码至少需要 8 位。');
    if (code === 'AUTH_DATABASE_DISABLED') return fail('AUTH_DATABASE_DISABLED', '真实登录需要先开启数据库配置。', undefined, 503);
    return fail('AUTH_FAILED', '登录暂时没有成功，可以稍后再试。', undefined, 500);
  }
}
