import { fail, ok, waitMock } from '@/lib/api-response';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { understandingFeedbackSchema } from '@/lib/schemas';
import { isFastAIEnabled } from '@/lib/server/ark-agents';
import { resolveTenant } from '@/lib/server/memory/tenant';
import { submitFeedback } from '@/lib/server/store';

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError();
  const body = await request.json().catch(() => ({}));
  const parsed = understandingFeedbackSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten());

  if (!isFastAIEnabled()) await waitMock(220);
  const tenant = await resolveTenant();
  const result = await submitFeedback(parsed.data.conversationId, tenant, parsed.data.cardId, parsed.data.feedbackType, parsed.data.text);
  if (!result) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);

  return ok(result);
}
