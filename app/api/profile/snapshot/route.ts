import { fail, ok, waitMock } from '@/lib/api-response';
import { profileSnapshotQuerySchema } from '@/lib/schemas';
import { callAgentJson } from '@/lib/server/ark-agents';
import { getRequestIdentity } from '@/lib/server/auth';
import { loadProfileSnapshotContext } from '@/lib/server/db';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = profileSnapshotQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return fail('BAD_REQUEST', '孩子档案暂时没有刷新成功，可以再试一次。', parsed.error.flatten());

  await waitMock(300);
  const identity = await getRequestIdentity({ familyId: parsed.data.familyId, childId: parsed.data.childId });
  const context = await loadProfileSnapshotContext(identity.familyId, identity.childId).catch((error) => {
    console.error('[childos] load profile context failed', error);
    return { digest: undefined, memories: [], events: [], latestUnderstandingCard: undefined };
  });
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

  return ok(
    snapshot || {
      recentChanges: [
        {
          title: '数学作业开始前更容易拖延',
          body: '当前更像是启动压力，而不是单纯贪玩手机。'
        },
        {
          title: '催促后容易进入防御',
          body: '家长一提醒，孩子可能先听成“不被信任”。'
        }
      ],
      currentFocus: '先别急着围绕“手机”制定规则，优先观察孩子到底卡在开始前，还是卡在某一道题之后。',
      recentRecords: [],
      communicationTip: '',
      hasUnreadUpdate: false,
      latestUnderstandingCard: context.latestUnderstandingCard
    }
  );
}
