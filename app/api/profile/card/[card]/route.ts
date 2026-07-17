import { ok } from '@/lib/api-response'
import { verifyAppApi, authError } from '@/lib/server/auth-guard'
import { resolveTenant } from '@/lib/server/memory/tenant'
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store'
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder'
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest'
import { loadDailyUiSnapshot } from '@/lib/server/profile/daily-refresh-agent'
import {
  getLatestBuiltProfileSnapshot,
  getLatestEvidenceNetwork,
} from '@/lib/server/memory/database-manager'
import { enrichPortraitCardContent } from '@/lib/server/profile/portrait-card-enrich'
import { buildPortraitCardDetail } from '@/lib/server/profile/portrait-card-detail'
import {
  pickDynamicChainCells,
  pickTopMechanismCards,
} from '@/lib/server/profile/parent-mechanism-view'
import type { PortraitCardKey } from '@/types/portrait-card'

const CARD_KEYS = ['growth', 'focus', 'behavior', 'interaction', 'strategies', 'hypotheses', 'tensions'] as const
export type ProfileCardKey = (typeof CARD_KEYS)[number]

const CARD_TITLES: Record<ProfileCardKey, string> = {
  growth: '动态成长画像',
  focus: '值得长期关注',
  behavior: '孩子行为模式',
  interaction: '亲子互动关系',
  strategies: '试试这些好方法',
  hypotheses: '孩子写作业的机制',
  tensions: '孩子健康成长阻力',
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
  const network = await getLatestEvidenceNetwork(tenant).catch(() => null)

  const extras = {
    coreJudgment: built?.coreJudgment,
    supportFocus: built?.supportFocus,
    preferLlm: Boolean(ui?.portraitCards?.[key as PortraitCardKey] && ui.source === 'llm'),
  }

  const topMechanisms = pickTopMechanismCards(network?.candidateMechanismMatrix, 5)
  const chainCells = pickDynamicChainCells({
    matrix: network?.candidateMechanismMatrix,
    deepMechanismText: built?.deepMechanism || '',
  })

  const shared = {
    topMechanisms,
    chainCells,
    defaultTab: 'top5' as const,
  }

  const rawCard = ui?.portraitCards?.[key as PortraitCardKey]
  const enriched = enrichPortraitCardContent(key as PortraitCardKey, rawCard, digestPack, extras)
  // preferLlm 时不再用 digest 事实盖写；仅空卡时附少量锚定事实
  const detail = extras.preferLlm
    ? {
        summary: enriched.summary,
        lead: enriched.lead,
        sections: enriched.sections || [],
        anchoredFacts: [] as string[],
      }
    : buildPortraitCardDetail(key as PortraitCardKey, enriched, digestPack)

  return ok({
    card: key,
    title: CARD_TITLES[key],
    summary: detail.summary,
    lead: detail.lead,
    sections: detail.sections,
    anchoredFacts: detail.anchoredFacts,
    mechanismNarrative: digestPack.mechanismNarrative,
    refreshedAt: ui?.refreshedAt || digest?.updatedAt || null,
    ...shared,
  })
}
