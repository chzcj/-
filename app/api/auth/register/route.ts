import { fail, ok } from '@/lib/api-response';
import { authCredentialsSchema } from '@/lib/schemas';
import { registerWithPhonePassword } from '@/lib/server/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = authCredentialsSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '手机号或密码格式不对，请再检查一下。', parsed.error.flatten());

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
  if (code === 'AUTH_DATABASE_DISABLED') return fail('AUTH_DATABASE_DISABLED', '真实登录需要先开启数据库配置。', undefined, 503);
  return fail('AUTH_FAILED', '注册暂时没有成功，可以稍后再试。', undefined, 500);
}
