import { fail, ok, waitMock } from '@/lib/api-response';
import { recordChildSchema } from '@/lib/schemas';
import { callAgentJson } from '@/lib/server/ark-agents';
import { getRequestIdentity } from '@/lib/server/auth';
import { insertMemoryRecords, rebuildFamilyMemoryDigest, saveChildEvent } from '@/lib/server/db';
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline';
import { enqueueJob } from '@/lib/server/jobs/queue';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = recordChildSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '记录暂时没有保存成功，可以再试一次。', parsed.error.flatten());

  await waitMock(260);
  const input = parsed.data;
  const identity = await getRequestIdentity({ familyId: input.familyId, childId: input.childId });
  const title = input.eventText.slice(0, 28) || input.changeText.slice(0, 28) || '一条新的孩子记录';
  const draft = await callAgentJson<{
    title?: string;
    eventSummary?: string;
    keyObservations?: string[];
    observationNext?: string;
    memoryWriteSuggestion?: { shouldWrite?: boolean; type?: string; reason?: string };
  }>('eventRecording', '整理家长记录的一件事。', input).catch((error) => {
    console.error('[childos] eventRecording failed', error);
    return undefined;
  });

  const eventId = await saveChildEvent({
    familyId: identity.familyId,
    childId: identity.childId,
    title: draft?.title || title,
    eventText: input.eventText,
    changeText: input.changeText,
    worryText: input.worryText,
    draft
  }).catch((error) => {
    console.error('[childos] save child event failed', error);
    return undefined;
  });

  if (draft?.memoryWriteSuggestion?.shouldWrite !== false) {
    const written = await insertMemoryRecords([
      {
        familyId: identity.familyId,
        childId: identity.childId,
        type: draft?.memoryWriteSuggestion?.type || 'raw_event',
        title: draft?.title || title,
        content: draft?.eventSummary || [input.eventText, input.changeText, input.worryText].filter(Boolean).join('；'),
        evidence: input.eventText,
        confidence: 'low',
        tags: ['record_child']
      }
    ]).catch((error) => {
      console.error('[childos] insert record memory failed', error);
      return 0;
    });
    if (written > 0) {
      await rebuildFamilyMemoryDigest(identity.familyId, identity.childId).catch((error) => {
        console.error('[childos] rebuild record digest failed', error);
      });
    }
  }

  // Episode 抽取入队（可靠重试 + 去重）。用登录用户真实租户，与 daily 检索同源；
  // episodeId 按 (tenant + sha(text)) 派生作幂等键，eventId 仅写溯源不进键。
  const recordText = [input.eventText, input.changeText, input.worryText].filter(Boolean).join('。');
  const episodeId = deriveEpisodeId(recordText, { familyId: identity.familyId, childId: identity.childId });
  void enqueueJob('episode_ingest', {
    text: recordText,
    ctx: { sourceEventId: eventId || undefined, familyId: identity.familyId, childId: identity.childId, episodeId }
  }, episodeId, eventId || undefined);

  return ok({
    eventId: eventId || `local_${Date.now()}`,
    draft: draft || {
      title,
      eventSummary: [input.eventText, input.changeText, input.worryText].filter(Boolean).join('；'),
      keyObservations: [],
      observationNext: input.worryText
    }
  });
}
