import { fail, ok } from '@/lib/api-response';
import { getConversation } from '@/lib/server/store';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const conversation = getConversation(params.id);
  if (!conversation) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);
  return ok(conversation);
}
