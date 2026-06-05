import { fail, ok, waitMock } from '@/lib/api-response';
import { archiveConfirmSchema } from '@/lib/schemas';
import { confirmArchive } from '@/lib/server/store';
import type { ArchiveDraft } from '@/types/childos';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = archiveConfirmSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '档案暂时没有存成功，可以再试一次。', parsed.error.flatten());

  await waitMock(700);
  const archive: ArchiveDraft = {
    schemaVersion: 'childos.archive_draft.v1',
    ok: true,
    conversationId: parsed.data.conversationId,
    ...parsed.data.archive
  };
  const result = await confirmArchive(parsed.data.conversationId, archive);
  if (!result) return fail('CONVERSATION_NOT_FOUND', '我找不到刚刚那次整理了。', undefined, 404);

  return ok(result);
}
