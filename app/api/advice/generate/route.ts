import { fail, ok, waitMock } from '@/lib/api-response';
import { adviceGenerateSchema } from '@/lib/schemas';
import { generateAdvice } from '@/lib/server/store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = adviceGenerateSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '建议卡没有顺利生成出来，我们可以再试一次。', parsed.error.flatten());

  await waitMock(800);
  const card = generateAdvice(parsed.data.conversationId);
  if (!card) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);

  return ok({ adviceId: card.adviceId, card });
}
