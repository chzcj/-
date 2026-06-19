import { fail, ok } from '@/lib/api-response';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { recordChildSchema } from '@/lib/schemas';
import { callAgentJson } from '@/lib/server/ark-agents';
import { resolveTenant } from '@/lib/server/memory/tenant';
import { saveChildEvent } from '@/lib/server/db';
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline';
import { buildMemoryWritePlan } from '@/lib/server/memory/pipeline';
import { createDailyUpdate } from '@/lib/server/memory/write/decision-engine';
import { enqueueJob } from '@/lib/server/jobs/queue';
import { createId } from '@/lib/storage/storageIds';
import { recordFeatureTurn } from '@/lib/server/memory/turn-event';

export async function POST(request: Request) {
  // 鉴权：middleware 仅查 cookie 存在性，补 route 级守卫堵伪造 cookie。
  if (!(await verifyAppApi(request))) return authError();
  const body = await request.json().catch(() => ({}));
  const parsed = recordChildSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '记录暂时没有保存成功，可以再试一次。', parsed.error.flatten());

  const input = parsed.data;
  // 会话身份为准，忽略 body 的 familyId/childId，杜绝登录用户借 body 越权写他人租户。
  const identity = await resolveTenant();
  // 路由级 traceId：同时贯穿 memory_write 入队与 TurnEvent 快照（强字段闭环）。
  const traceId = createId('trace');
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

  // 统一走标准记忆链路（与 daily 对齐，单一口径）：Episode 抽取 + memory_write→digest_update→Board/Brief。
  // eventRecording agent 判定不值得入记忆(shouldWrite:false)时只留 child_events，不进记忆层。
  // 已下线旧的 insertMemoryRecords + rebuildFamilyMemoryDigest 双写（Board 不读旧表，记录仍由 child_events 入周报）。
  if (draft?.memoryWriteSuggestion?.shouldWrite !== false) {
    const recordText = [input.eventText, input.changeText, input.worryText].filter(Boolean).join('。');
    // Episode 抽取入队（可靠重试 + 去重）：episodeId 按 (tenant + sha(text)) 派生作幂等键。
    const episodeId = deriveEpisodeId(recordText, { familyId: identity.familyId, childId: identity.childId });
    void enqueueJob('episode_ingest', {
      text: recordText,
      ctx: { sourceEventId: eventId || undefined, familyId: identity.familyId, childId: identity.childId, episodeId }
    }, episodeId, eventId || undefined);

    // memory_write → digest_update → BoardSnapshot/Brief，让"记录孩子"驱动家庭看板与简报。
    const writePlan = buildMemoryWritePlan({
      tenant: identity,
      dailyUpdates: [createDailyUpdate(`[记录孩子] ${recordText}`, 'insufficient', [], identity, eventId || undefined)],
      rationale: {
        whyUpdate: '家长记录了一件孩子的事',
        whyNotPromoteSomeItems: '单条记录属观察线索，暂不升级为长期判断',
        riskOfOvergeneralization: '',
        nextVerificationNeed: ''
      }
    });
    void enqueueJob('memory_write', { plan: writePlan, tenant: identity }, null, traceId);
  }

  // TurnEvent 快照（字段闭环全覆盖）：记录本轮记录输入+整理产出（shouldWrite 与否都落，审计完整）。
  recordFeatureTurn({
    traceId, tenant: identity, mode: 'child_record',
    userMessage: input.eventText || input.changeText || input.worryText,
    assistantReply: draft?.eventSummary || draft?.title || title,
    specializedContextPack: { changeText: input.changeText, worryText: input.worryText }
  });

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
