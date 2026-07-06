import { ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { loadDailyUiSnapshot } from '@/lib/server/profile/daily-refresh-agent'
import { getLatestBuiltProfileSnapshot } from '@/lib/server/memory/database-manager'
import { enrichPortraitCardBody } from '@/lib/server/profile/portrait-card-enrich'

const CARD_KEYS = ['growth', 'focus', 'behavior', 'interaction', 'strategies', 'hypotheses', 'tensions'] as const
export type ProfileCardKey = (typeof CARD_KEYS)[number]

const CARD_TITLES: Record<ProfileCardKey, string> = {
  growth: '动态成长画像',
  focus: '当前关注点',
  behavior: '行为模式总结',
  interaction: '家庭互动模式',
  strategies: '有效策略',
  hypotheses: '待验证假设',
  tensions: '家庭运转张力',
}

export async function GET(
  request: Request,
  context: { params: Promise<{ card: string }> }
) {
  if (!(await verifyAppApi(request))) return authError()
  const { card } = await context.params
  if (!CARD_KEYS.includes(card as ProfileCardKey)) {
    return ok({ error: 'unknown_card' })
  }
  const key = card as ProfileCardKey
  const tenant = await resolveTenant()

  let digest = await loadDeepModelDigest(tenant).catch(() => null)
  if (!digest?.mechanismNarrative) {
    digest = await buildDeepModelDigest(tenant).catch(() => digest)
  }
  const digestPack = pickDeepModelDigestPack(digest)
  const ui = await loadDailyUiSnapshot(tenant).catch(() => null)
  const built = await getLatestBuiltProfileSnapshot(tenant).catch(() => null)

  const portraitBody = key === 'tensions' ? '' : (ui?.portraitCards?.[key as keyof typeof ui.portraitCards] || '')
  const extras = { coreJudgment: built?.coreJudgment, supportFocus: built?.supportFocus }
  const fallbackBodies: Record<ProfileCardKey, string> = {
    growth: portraitBody || digestPack.mechanismNarrative || built?.coreJudgment || '',
    focus: portraitBody || digestPack.cultivationFocus || built?.supportFocus || '',
    behavior: portraitBody || digestPack.anchoredFacts.join('\n') || built?.coreJudgment || '',
    interaction: portraitBody || digestPack.interactionLoops.join('\n') || built?.deepMechanism || '',
    strategies: portraitBody || digestPack.cultivationFocus || built?.supportFocus || '',
    hypotheses: portraitBody || digestPack.openHypotheses.join('\n') || '',
    tensions: portraitBody || (digest?.structuralTensions || []).map((t) => `${t.title}：${t.detail}`).join('\n'),
  }

  const structuralTensions = digest?.structuralTensions || []

  return ok({
    card: key,
    title: CARD_TITLES[key],
    body: key === 'tensions'
      ? structuralTensions.map((t) => `${t.title}：${t.detail}`).join('\n\n')
      : enrichPortraitCardBody(key, fallbackBodies[key], digestPack, extras),
    anchoredFacts: digestPack.anchoredFacts,
    mechanismNarrative: digestPack.mechanismNarrative,
    structuralTensions: key === 'tensions' ? structuralTensions : undefined,
    refreshedAt: ui?.refreshedAt || digest?.updatedAt || null,
  })
}
