import { fail, ok, waitMock } from '@/lib/api-response';
import { startConversationSchema } from '@/lib/schemas';
import { getRequestIdentity } from '@/lib/server/auth';
import { startConversation } from '@/lib/server/store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = startConversationSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten());

  await waitMock(450);
  const identity = await getRequestIdentity({ familyId: parsed.data.familyId, childId: parsed.data.childId });
  const conversation = await startConversation(identity.familyId, identity.childId);
  return ok({
    conversationId: conversation.conversationId,
    currentRound: conversation.currentRound,
    firstPrompt: conversation.firstPrompt
  });
}
