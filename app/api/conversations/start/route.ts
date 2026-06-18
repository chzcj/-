import { fail, ok, waitMock } from '@/lib/api-response';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { startConversationSchema } from '@/lib/schemas';
import { resolveTenant } from '@/lib/server/memory/tenant';
import { startConversation } from '@/lib/server/store';

export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError();
  const body = await request.json().catch(() => ({}));
  const parsed = startConversationSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这次输入没有整理成功，可以再试一次。', parsed.error.flatten());

  await waitMock(450);
  // 会话身份为准，忽略 body 的 familyId/childId，杜绝登录用户越权创建他人租户会话。
  const identity = await resolveTenant();
  const conversation = await startConversation(identity.familyId, identity.childId);
  return ok({
    conversationId: conversation.conversationId,
    currentRound: conversation.currentRound,
    firstPrompt: conversation.firstPrompt
  });
}
