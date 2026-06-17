import { ok, waitMock } from '@/lib/api-response'
import { callAgentJson } from '@/lib/server/ark-agents'
import { getRequestIdentity } from '@/lib/server/auth'
import { loadProfileSnapshotContext, loadLatestBoardSnapshot } from '@/lib/server/db'
import { enqueueJob } from '@/lib/server/jobs/queue'

/* ================================================================
   家庭支持看板 board（交付文档 2 / 7.6 / 12.3）
   五段式：当前状态 / 稳定理解 / 互动模式 / 待验证点 / 下一步。
   优先读后台持久化的 BoardSnapshot（含 version/evidenceRefs/updatedAt）；
   无快照时回退实时生成并自愈入队 digest_update，下次走快照。
   ================================================================ */

type EvidenceRef = { kind?: string; id?: string; at?: string; snippet?: string }
type BoardSnapshot = {
  childCurrentState: string
  stableUnderstanding: string[]
  familyInteractionPatterns: string[]
  recentChanges: string[]
  pendingQuestions: string[]
  currentBestNextStep: string
  version?: number
  evidenceRefs?: EvidenceRef[]
  updatedAt?: string
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
  await waitMock(120)
  const identity = await getRequestIdentity()

  // 1) 优先读持久化最新快照（快，无 LLM）。历史快照字段可能缺失/漂移，命中也跑 normalize 兜底。
  const snap = await loadLatestBoardSnapshot(identity.familyId, identity.childId).catch(() => undefined)
  if (snap) {
    return ok<BoardSnapshot>(normalizeBoard(snap.snapshot, {
      version: snap.version,
      evidenceRefs: snap.evidenceRefs as EvidenceRef[],
      updatedAt: snap.updatedAt
    }))
  }

  // 2) 无快照（新家庭 / digest 未跑）→ 回退实时生成（保留现有体验）。
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

  // 3) 自愈入队（null 键，每次 miss 都入队，靠 content_hash 短路防重复），让下次走快照。
  void enqueueJob('digest_update', { tenant: { familyId: identity.familyId, childId: identity.childId } }, null, null)

  return ok<BoardSnapshot>(normalizeBoard(board || {}))
}

// 逐字段兜底 + FALLBACK；快照命中与实时回退共用。
function normalizeBoard(raw: Record<string, unknown> | Partial<BoardSnapshot>, meta?: { version?: number; evidenceRefs?: EvidenceRef[]; updatedAt?: string }): BoardSnapshot {
  const r = raw as Partial<BoardSnapshot>
  const pending = strList(r.pendingQuestions)
  return {
    childCurrentState: textOr(r.childCurrentState, FALLBACK.childCurrentState),
    stableUnderstanding: strList(r.stableUnderstanding),
    familyInteractionPatterns: strList(r.familyInteractionPatterns),
    recentChanges: strList(r.recentChanges),
    pendingQuestions: pending.length > 0 ? pending : FALLBACK.pendingQuestions,
    currentBestNextStep: textOr(r.currentBestNextStep, FALLBACK.currentBestNextStep),
    ...(meta?.version !== undefined ? { version: meta.version } : {}),
    ...(meta?.evidenceRefs ? { evidenceRefs: meta.evidenceRefs } : {}),
    ...(meta?.updatedAt ? { updatedAt: meta.updatedAt } : {})
  }
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
