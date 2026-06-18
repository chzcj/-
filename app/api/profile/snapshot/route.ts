import { fail, ok } from '@/lib/api-response';
import { callAgentJson } from '@/lib/server/ark-agents';
import { getRequestIdentity } from '@/lib/server/auth';
import { loadProfileSnapshotContext } from '@/lib/server/db';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';

export async function GET(request: Request) {
  // 鉴权：与其它前台数据接口一致（此处此前缺失，正是匿名越权读档案的入口）。
  if (!verifyAppApi(request)) return authError();

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

  // 2) 无 digest：尝试 LLM 轻量生成。
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
    context
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
