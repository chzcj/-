import { fail, ok, waitMock } from '@/lib/api-response';
import { archiveDraftQuerySchema } from '@/lib/schemas';
import { getOrCreateArchive } from '@/lib/server/store';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = archiveDraftQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return fail('BAD_REQUEST', '档案草稿暂时没有整理成功，可以再试一次。', parsed.error.flatten());

  await waitMock(500);
  const archive = getOrCreateArchive(parsed.data.conversationId);
  if (!archive) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);

  return ok(archive);
}
