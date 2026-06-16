import { ok, waitMock } from '@/lib/api-response'
import { callAgentJson } from '@/lib/server/ark-agents'
import { getRequestIdentity } from '@/lib/server/auth'
import { loadProfileSnapshotContext } from '@/lib/server/db'

/* ================================================================
   家庭支持看板 board（交付文档 2 / 7.6 / 12.3）
   五段式：当前状态 / 稳定理解 / 互动模式 / 待验证点 / 下一步。
   由 BoardUpdater 生成，不由前端伪造。
   ================================================================ */

type BoardSnapshot = {
  childCurrentState: string
  stableUnderstanding: string[]
  familyInteractionPatterns: string[]
  recentChanges: string[]
  pendingQuestions: string[]
  currentBestNextStep: string
}

// 证据不足或 LLM 未启用时的温和空态，不硬编画像。
const FALLBACK: BoardSnapshot = {
  childCurrentState: '还在一起把孩子的情况看清楚，暂时不急着下判断。',
  stableUnderstanding: [],
  familyInteractionPatterns: [],
  recentChanges: [],
  pendingQuestions: ['可以先多记几个具体场景，比如孩子在作业开始前和开始后的不同反应。'],
  currentBestNextStep: '这一两周先随手记一两个真实片段，不用分析，系统会慢慢看清。'
}

export async function GET() {
  await waitMock(200)
  const identity = await getRequestIdentity()
  const context = await loadProfileSnapshotContext(identity.familyId, identity.childId).catch((error) => {
    console.error('[childos] load board context failed', error)
    return { digest: undefined, memories: [], events: [], latestUnderstandingCard: undefined }
  })

  const board = await callAgentJson<Partial<BoardSnapshot>>(
    'boardUpdater',
    '根据近期记忆和孩子记录，生成家长可见的家庭支持看板。',
    { familyId: identity.familyId, childId: identity.childId, context }
  ).catch((error) => {
    console.error('[childos] boardUpdater failed', error)
    return undefined
  })

  const pending = strList(board?.pendingQuestions)
  return ok<BoardSnapshot>({
    childCurrentState: textOr(board?.childCurrentState, FALLBACK.childCurrentState),
    stableUnderstanding: strList(board?.stableUnderstanding),
    familyInteractionPatterns: strList(board?.familyInteractionPatterns),
    recentChanges: strList(board?.recentChanges),
    pendingQuestions: pending.length > 0 ? pending : FALLBACK.pendingQuestions,
    currentBestNextStep: textOr(board?.currentBestNextStep, FALLBACK.currentBestNextStep)
  })
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 4)
}
