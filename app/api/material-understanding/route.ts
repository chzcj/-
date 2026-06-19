import { fail, ok } from '@/lib/api-response';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { materialUnderstandingSchema } from '@/lib/schemas';
import { callAgentJson } from '@/lib/server/ark-agents';
import { resolveTenant } from '@/lib/server/memory/tenant';
import { deriveEpisodeId } from '@/lib/server/memory/episode/pipeline';
import { buildMemoryWritePlan } from '@/lib/server/memory/pipeline';
import { createDailyUpdate } from '@/lib/server/memory/write/decision-engine';
import { enqueueJob } from '@/lib/server/jobs/queue';
import { createId } from '@/lib/storage/storageIds';

// 材料理解：家长贴入材料文本 → 前台 Agent 给家长可读解读；
// 后台把材料抽成事实并标 sourceType=material_observation 写入记忆，驱动 Board/Brief。
export async function POST(request: Request) {
  // 鉴权：middleware 仅查 cookie 存在性，补 route 级守卫堵伪造 cookie。
  if (!(await verifyAppApi(request))) return authError();
  const body = await request.json().catch(() => ({}));
  const parsed = materialUnderstandingSchema.safeParse(body);
  if (!parsed.success) return fail('BAD_REQUEST', '这份材料暂时没能读取，可以再试一次。', parsed.error.flatten());

  const { materialText, materialType } = parsed.data;
  // 会话身份为准，忽略 body 的 familyId/childId，杜绝登录用户借 body 越权写他人租户。
  const identity = await resolveTenant();
  const traceId = createId('trace');

  const draft = await callAgentJson<{ visibleReply?: string; keyPoints?: string[] }>(
    'materialUnderstanding',
    '理解家长贴入的一份材料。',
    { materialText, materialType }
  ).catch((error) => {
    console.error('[childos] materialUnderstanding failed', error);
    return undefined;
  });

  // 降级文案：LLM 不可用时不出假解读，给中性提示。
  const reading = draft?.visibleReply?.trim()
    || '这份材料我先收下了。现在还没法在线读出更多，可以稍后再试一次，或把材料里最关键的一两句话单独发给我。';
  const keyPoints = Array.isArray(draft?.keyPoints) ? draft.keyPoints.filter(Boolean).slice(0, 3) : [];

  // 后台：把材料抽成事实并标 material_observation（episode_ingest 带 materialSource 提示）。
  const episodeId = deriveEpisodeId(materialText, { familyId: identity.familyId, childId: identity.childId });
  void enqueueJob('episode_ingest', {
    text: materialText,
    ctx: {
      sourceEventId: traceId,
      familyId: identity.familyId,
      childId: identity.childId,
      episodeId,
      materialSource: { isMaterial: true, materialType }
    }
  }, episodeId, traceId);

  // memory_write → digest_update → BoardSnapshot/Brief，让材料理解驱动家庭看板与简报。
  const writePlan = buildMemoryWritePlan({
    tenant: identity,
    dailyUpdates: [createDailyUpdate(`[材料理解] ${materialText.slice(0, 200)}`, 'insufficient', [], identity, traceId)],
    rationale: {
      whyUpdate: '家长贴入了一份材料',
      whyNotPromoteSomeItems: '材料只作为事实来源，单份材料暂不升级为长期判断',
      riskOfOvergeneralization: '材料里的评价不等于孩子定论',
      nextVerificationNeed: ''
    }
  });
  void enqueueJob('memory_write', { plan: writePlan, tenant: identity }, null, traceId);

  return ok({ traceId, reading, keyPoints });
}
