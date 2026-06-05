import { fail, ok, waitMock } from '@/lib/api-response';
import { understandingGenerateSchema } from '@/lib/schemas';
import { isArkEnabled, isFastAIEnabled } from '@/lib/server/ark-agents';
import { generateUnderstanding } from '@/lib/server/store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = understandingGenerateSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这张理解卡没有顺利生成出来，我们可以再试一次。', parsed.error.flatten());

  if (!isArkEnabled() && !isFastAIEnabled()) await waitMock(900);
  const card = await generateUnderstanding(parsed.data.conversationId);
  if (!card) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);

  return ok({ cardId: card.cardId, card });
}
