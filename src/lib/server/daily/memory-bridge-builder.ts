/**
 * @deprecated 未接入 daily BFF；记忆桥接段落已由 section composer / prose 检索包替代。
 * 保留仅供历史参考，新功能勿引用。
 */
import 'server-only'

import type { DailyCards, OrchestrationOutput } from '@/types/database'
import { rankByRelevance } from '@/lib/server/memory/embedding'
import { filterRetrievalSnippets, sanitizeForParent } from '@/lib/server/daily/profile-sanitize'

function truncate(text: string, max: number) {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

const MIN_RELEVANCE_SCORE = 0.28

/**
 * 向量语义排序 + 推理合成（不堆原文 bullet）。
 * 候选池来自 retrieval router 已召回的 events/evidence，再对本轮 userText 精排。
 */
export async function buildRankedMemoryBridgeParagraphs(
  output: OrchestrationOutput,
  cards: DailyCards,
  userText: string
): Promise<string[]> {
  const ctx = output.retrievedContext
  const pool = filterRetrievalSnippets(
    [
      ...(ctx.relevantPastEvents || []),
      ...(ctx.relevantEntryEvidencePacks || []),
    ],
    userText,
    12
  )

  const mechanism = sanitizeForParent(ctx.matchedMechanisms?.[0]?.replace(/^还在验证：?/, ''))
  const pattern = sanitizeForParent(ctx.relevantFamilyInteractionPatterns?.[0])
  const hypo = sanitizeForParent(ctx.relevantPendingHypotheses?.[0]?.replace(/^还在验证：?/, ''))

  const reasoning: string[] = []

  if (pool.length > 0) {
    const ranked = await rankByRelevance(userText, pool, (e) => e, 5)
    const relevant = ranked
      .filter((r) => r.score <= 0 || r.score >= MIN_RELEVANCE_SCORE)
      .slice(0, 2)
      .map((r) => r.item)

    if (relevant.length >= 2) {
      reasoning.push(
        `从记忆库里和这次最相关的两条线索看：一是${truncate(relevant[0], 48)}；二是${truncate(relevant[1], 48)}。它们连起来说明，问题往往不只在表面行为，而在你们家熟悉的「反馈—检查—补漏」节奏里。`
      )
    } else if (relevant.length === 1) {
      reasoning.push(
        `记忆库里和这次最相关的一条线索是：${truncate(relevant[0], 90)}。这次和它对得上，所以我不把它当偶发。`
      )
    }
  }

  if (pattern && mechanism && reasoning.length < 2) {
    reasoning.push(
      `从你们家这几周的运行方式看，${truncate(pattern, 72)}；而${truncate(mechanism, 72)}。`
    )
  } else if (pattern && reasoning.length === 0) {
    reasoning.push(`前面你提到过：${truncate(pattern, 100)}。这次像是在同一套家庭节奏里又出现了一次。`)
  } else if (mechanism && reasoning.length === 0) {
    reasoning.push(`从最近几次看，反复出现的信号是：${truncate(mechanism, 100)}。`)
  } else if (hypo && reasoning.length === 0) {
    reasoning.push(`我还在验证的一个方向是：${truncate(hypo, 100)}。`)
  }

  if (userText.includes('老师') && userText.includes('反馈') && reasoning.length < 2) {
    reasoning.push('只要老师一反馈、你一急、开始检查，他往往就回到旧路；少讲大道理、说好不加任务时，他会好一点。')
  }

  if (cards.evidenceBasis && reasoning.length === 0) {
    reasoning.push(truncate(cards.evidenceBasis, 120))
  }

  return reasoning.slice(0, 2)
}
