import { fail, ok, waitMock } from '@/lib/api-response';
import { understandingFeedbackSchema } from '@/lib/schemas';
import { submitFeedback } from '@/lib/server/store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = understandingFeedbackSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten());

  await waitMock(700);
  const result = submitFeedback(parsed.data.conversationId, parsed.data.cardId, parsed.data.feedbackType, parsed.data.text);
  if (!result) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);

  return ok(result);
}
