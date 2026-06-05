import { fail, ok, waitMock } from '@/lib/api-response';
import { rehearsalAnalyzeSchema } from '@/lib/schemas';
import { generateRehearsal } from '@/lib/server/store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = rehearsalAnalyzeSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten());

  await waitMock(850);
  const result = await generateRehearsal(parsed.data.conversationId, parsed.data.parentText);
  if (!result) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);

  return ok({ rehearsalId: result.rehearsalId, result });
}
