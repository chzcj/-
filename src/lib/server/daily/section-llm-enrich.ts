/**
 * @deprecated 未接入 daily BFF 主流程；hidden section 已由 fillDailySectionCopy 替代。
 * 保留仅供历史参考，新功能勿引用。
 */
import 'server-only'

import type { OrchestrationOutput } from '@/types/database'
import type { DailySection } from '@/types/daily-message'
import { callAgentJson, isFastAIEnabled } from '@/lib/server/ark-agents'
import { buildDailyProsePayload } from '@/lib/server/daily/prose-context'
import { isPlaceholderProfileText, sanitizeForParent } from '@/lib/server/daily/profile-sanitize'
import { buildFamilyStructure, buildSceneChildVoice } from '@/lib/server/daily/second-me-content'

function cleanParagraphs(paragraphs: string[] | undefined, fallback: string[]): string[] {
  const out = (paragraphs || [])
    .map((p) => p.trim())
    .filter((p) => p.length > 8 && !isPlaceholderProfileText(p))
  return out.length ? out : fallback
}

function cleanQuotes(quotes: string[] | undefined, fallback: string[]): string[] {
  const out = (quotes || [])
    .map((q) => q.replace(/^["「]|["」]$/g, '').trim())
    .filter((q) => q.length > 6 && !isPlaceholderProfileText(q))
  return out.length ? out.slice(0, 3) : fallback
}

/** 高置信 hidden 块：LLM 生成家庭结构 + 孩子内心翻译（失败则规则兜底） */
export async function enrichHighConfidenceSections(
  sections: DailySection[],
  output: OrchestrationOutput,
  userText: string
): Promise<DailySection[]> {
  if (!isFastAIEnabled()) return sections

  const payload = buildDailyProsePayload(output, userText)
  const ruleFamily = buildFamilyStructure(output, userText)
  const ruleChild = buildSceneChildVoice(userText)
  const out = sections.map((s) => ({ ...s }))

  const familyIdx = out.findIndex((s) => s.id === 'profile_reading')
  const childIdx = out.findIndex((s) => s.id === 'child_voice')

  const [familyLlm, childLlm] = await Promise.all([
    familyIdx >= 0
      ? callAgentJson<{ paragraphs: string[] }>(
          'dailyDialogueOrchestration',
          [
            '只输出 JSON：{ "paragraphs": string[] }。',
            '你是 SecondMe 家庭结构解释器。根据 retrievalPack 写「放回你们家的结构里」。',
            '必须回答至少两点：谁在执行压力；孩子反抗的是人还是流程。',
            '禁止测试画像ID、禁止空泛育儿建议、禁止 markdown。',
            '1–2 段，每段 ≤120 字。',
          ].join('\n'),
          { ...payload, section: 'family_structure', ruleFallback: ruleFamily }
        ).catch(() => undefined)
      : Promise.resolve(undefined),
    childIdx >= 0
      ? callAgentJson<{ quotes: string[] }>(
          'dailyDialogueOrchestration',
          [
            '只输出 JSON：{ "quotes": string[] }。',
            '写「孩子没说出口的意思」——必须贴合 userText 当次场景，不可套模板。',
            '1–2 句第一人称内心话，不是家长建议。',
            '禁止测试占位、禁止 markdown。',
          ].join('\n'),
          { ...payload, section: 'child_inner_translation', ruleFallback: ruleChild }
        ).catch(() => undefined)
      : Promise.resolve(undefined),
  ])

  if (familyIdx >= 0) {
    out[familyIdx] = {
      ...out[familyIdx],
      paragraphs: cleanParagraphs(
        familyLlm?.paragraphs,
        ruleFamily ? [ruleFamily] : out[familyIdx].paragraphs || []
      ),
    }
  }

  if (childIdx >= 0) {
    out[childIdx] = {
      ...out[childIdx],
      quotes: cleanQuotes(childLlm?.quotes, ruleChild),
    }
  }

  const headlineIdx = out.findIndex((s) => s.id === 'diagnosis_headline')
  if (headlineIdx >= 0 && out[headlineIdx].paragraphs?.[0]) {
    const p = sanitizeForParent(out[headlineIdx].paragraphs![0])
    if (p) out[headlineIdx].paragraphs = [p]
  }

  return out
}
