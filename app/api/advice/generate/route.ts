import { fail, ok, waitMock } from '@/lib/api-response';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { adviceGenerateSchema } from '@/lib/schemas';
import { resolveTenant } from '@/lib/server/memory/tenant';
import { generateAdvice } from '@/lib/server/store';

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError();
  const body = await request.json().catch(() => ({}));
  const parsed = adviceGenerateSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '建议卡没有顺利生成出来，我们可以再试一次。', parsed.error.flatten());

  await waitMock(800);
  const tenant = await resolveTenant();
  const card = await generateAdvice(parsed.data.conversationId, tenant);
  if (!card) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);

  return ok({ adviceId: card.adviceId, card });
}
