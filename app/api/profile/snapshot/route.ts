import { fail, ok } from '@/lib/api-response';
import { callAgentJson } from '@/lib/server/ark-agents';
import { getRequestIdentity } from '@/lib/server/auth';
import { loadProfileSnapshotContext, loadLatestBoardSnapshot } from '@/lib/server/db';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store';
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder';
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest';

export async function GET(request: Request) {
  // 鉴权：与其它前台数据接口一致（此处此前缺失，正是匿名越权读档案的入口）。
  if (!(await verifyAppApi(request))) return authError();

  // 租户完全以会话身份为准，忽略任何查询参数，杜绝匿名跨租户越权读取（IDOR）。
  const identity = await getRequestIdentity();
  const context = await loadProfileSnapshotContext(identity.familyId, identity.childId).catch((error) => {
    console.error('[childos] load profile context failed', error);
    return { digest: undefined, memories: [], events: [], latestUnderstandingCard: undefined };
  });

  // 1) 有真实 digest：返回真实档案数据。
  if (context.digest?.recentChanges?.length || context.digest?.currentFocus || context.digest?.recentRecords?.length) {
    return ok({
      recentChanges: context.digest.recentChanges || [],
      currentFocus: context.digest.currentFocus || '',
      recentRecords: context.digest.recentRecords || [],
      communicationTip: context.digest.communicationTip || '',
      hasUnreadUpdate: Boolean(context.digest.hasUnreadUpdate),
      latestUnderstandingCard: context.latestUnderstandingCard
    });
  }

  // 1b) 活跃链（digest_update job）的看板正文写在 board_snapshots 表；
  //     旧 profile_board 列已无活跃写入方（读写错位）。命中则映射为档案页形状，
  //     避免每次请求都退化到 LLM 现场重生成（慢且不稳定）。
  const board = await loadLatestBoardSnapshot(identity.familyId, identity.childId).catch(() => undefined);
  const core = board?.snapshot as {
    childCurrentState?: string;
    stableUnderstanding?: string[];
    recentChanges?: string[];
    currentBestNextStep?: string;
  } | undefined;
  if (core && (core.childCurrentState || core.recentChanges?.length)) {
    return ok({
      recentChanges: (core.recentChanges || []).slice(0, 4).map((s) => ({ title: s.slice(0, 24), body: s })),
      currentFocus: core.childCurrentState || '',
      recentRecords: (core.stableUnderstanding || []).slice(0, 4).map((s) => ({ title: s.slice(0, 24), body: s })),
      communicationTip: core.currentBestNextStep || '',
      hasUnreadUpdate: false,
      latestUnderstandingCard: context.latestUnderstandingCard
    });
  }

  // 2) 无 digest：尝试 LLM 轻量生成。
  let deepDigest = await loadDeepModelDigest({ familyId: identity.familyId, childId: identity.childId }).catch(() => null);
  if (!deepDigest?.mechanismNarrative) {
    deepDigest = await buildDeepModelDigest({ familyId: identity.familyId, childId: identity.childId }).catch(() => deepDigest);
  }
  const deepModelDigest = pickDeepModelDigestPack(deepDigest);

  const snapshot = await callAgentJson<{
    recentChanges?: Array<{ title: string; body: string }>;
    currentFocus?: string;
    recentRecords?: Array<{ title: string; body: string }>;
    communicationTip?: string;
    hasUnreadUpdate?: boolean;
    latestUnderstandingCard?: {
      conversationId?: string;
      cardId?: string;
      title?: string;
      version?: string;
      preview?: string;
      updatedAt?: string;
    };
  }>('profileSnapshot', '根据近期记忆和孩子记录，生成孩子档案页面可用的轻量数据。', {
    familyId: identity.familyId,
    childId: identity.childId,
    context,
    deepModelDigest,
  }).catch((error) => {
    console.error('[childos] profileSnapshot failed', error);
    return undefined;
  });

  // 3) 既无真实 digest 又 LLM 不可用/失败：不编造画像，返回 503 让前台显示重试。
  //    红线：信息不足不能硬画像（对齐 weekly-review 的 503 设计）。
  if (!snapshot) {
    return fail('SNAPSHOT_UNAVAILABLE', '孩子档案暂时没有刷新成功，可以再试一次。', undefined, 503);
  }

  return ok({
    recentChanges: snapshot.recentChanges || [],
    currentFocus: snapshot.currentFocus || '',
    recentRecords: snapshot.recentRecords || [],
    communicationTip: snapshot.communicationTip || '',
    hasUnreadUpdate: Boolean(snapshot.hasUnreadUpdate),
    latestUnderstandingCard: snapshot.latestUnderstandingCard || context.latestUnderstandingCard
  });
}
