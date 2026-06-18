import { fail, ok } from '@/lib/api-response';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { resolveTenant } from '@/lib/server/memory/tenant';
import { getConversation } from '@/lib/server/store';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await verifyAppApi(request))) return authError();
  const tenant = await resolveTenant();
  const conversation = await getConversation(params.id, tenant);
  if (!conversation) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);
  return ok(conversation);
}
