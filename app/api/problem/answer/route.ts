import { fail, ok, waitMock } from '@/lib/api-response';
import { problemAnswerSchema } from '@/lib/schemas';
import { submitAnswer } from '@/lib/server/store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = problemAnswerSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten());

  await waitMock(700);
  const a1 = submitAnswer(parsed.data.conversationId, parsed.data.round, parsed.data.inputMode, parsed.data.text);
  if (!a1) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);

  return ok({
    nextAction: a1.clientActions.nextAction,
    a1
  });
}
