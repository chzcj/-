import { createHash } from 'node:crypto'
import { callFastJson } from '@/lib/server/ark-agents'
import {
  getLatestBuiltProfileSnapshot,
  getUserTasks,
  listTurnEvents,
  saveGrowthTrajectorySnapshot,
  type GrowthTrajectoryEntry,
  type GrowthTrajectorySnapshot,
} from '@/lib/server/memory/database-manager'
import type { TenantId } from '@/lib/server/memory/tenant'

type TrajectoryCandidate = {
  id: string
  occurredAt: string
  sourceType: '交流' | '预演' | '任务反馈' | '画像更新'
  sourceId: string
  text: string
  relatedTaskIds?: string[]
  relatedRehearsalIds?: string[]
}

type CuratorOutput = {
  summary?: string
  entries?: Array<{
    sourceId: string
    title: string
    summary: string
  }>
}

function short(value: string, max: number) {
  const text = value.trim()
  return text.length <= max ? text : `${text.slice(0, max).trim()}…`
}

export async function collectGrowthTrajectoryCandidates(tenant: TenantId): Promise<TrajectoryCandidate[]> {
  const [turns, tasks, built] = await Promise.all([
    listTurnEvents(tenant, 80),
    getUserTasks(tenant),
    getLatestBuiltProfileSnapshot(tenant),
  ])

  const candidates: TrajectoryCandidate[] = []
  for (const turn of turns) {
    const text = [turn.userMessage, turn.assistantReply].filter(Boolean).join('｜')
    if (!text.trim()) continue
    candidates.push({
      id: `turn:${turn.traceId}`,
      occurredAt: turn.createdAt,
      sourceType: turn.mode === 'communication_rehearsal' ? '预演' : '交流',
      sourceId: turn.traceId,
      text: short(text, 620),
      relatedRehearsalIds: turn.mode === 'communication_rehearsal' ? [turn.traceId] : undefined,
    })
  }

  for (const task of tasks) {
    if (!task.feedback?.completed && !task.feedback?.effect && !task.feedback?.reaction) continue
    const feedback = [
      task.feedback.completed ? `完成：${task.feedback.completed}` : '',
      task.feedback.effect ? `效果：${task.feedback.effect}` : '',
      task.feedback.reaction ? `孩子反应：${task.feedback.reaction}` : '',
      task.feedback.note || '',
    ].filter(Boolean).join('；')
    candidates.push({
      id: `task:${task.taskId}`,
      occurredAt: task.updatedAt || task.createdAt,
      sourceType: '任务反馈',
      sourceId: task.taskId,
      text: short(`${task.title}。${feedback}`, 620),
      relatedTaskIds: [task.taskId],
    })
  }

  if (built?.coreJudgment?.trim()) {
    candidates.push({
      id: `profile:${built.updatedAt}`,
      occurredAt: built.updatedAt,
      sourceType: '画像更新',
      sourceId: built.updatedAt,
      text: short(built.coreJudgment, 620),
    })
  }

  return candidates
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 80)
}

export async function getGrowthTrajectorySourceHash(tenant: TenantId) {
  const candidates = await collectGrowthTrajectoryCandidates(tenant)
  const raw = candidates.map((item) => `${item.id}:${item.occurredAt}:${item.text}`).join('\n')
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

/**
 * 后台筛选：只把可验证的变化、重复模式和有效尝试写成时间线。
 * 它不替代原始记忆，也不把单次冲突夸大为成长结论。
 */
export async function runGrowthTrajectoryUpdate(tenant: TenantId, sourceHash?: string): Promise<void> {
  const candidates = await collectGrowthTrajectoryCandidates(tenant)
  const hash = sourceHash || createHash('sha256')
    .update(candidates.map((item) => `${item.id}:${item.occurredAt}:${item.text}`).join('\n'))
    .digest('hex')
    .slice(0, 32)

  const ai = await callFastJson<CuratorOutput>(
    `你是育见的成长轨迹筛选 Agent。根据真实记录写一份给家长看的成长手账。
只选择有明确事实支撑的节点：孩子出现的变化、反复的模式、家长尝试过的做法及结果、关键沟通转折。
不要把单次冲突写成长期结论；不要贴诊断标签；不要编造没有的进步。每个条目必须对应输入 sourceId。
输出 JSON：{ "summary": string, "entries": [{ "sourceId": string, "title": string, "summary": string }] }。`,
    {
      candidates: candidates.map((item) => ({
        sourceId: item.sourceId,
        occurredAt: item.occurredAt,
        sourceType: item.sourceType,
        text: item.text,
      })),
    },
    { maxTokens: 2600 }
  ).catch(() => undefined)

  const bySource = new Map(candidates.map((item) => [item.sourceId, item]))
  const entries = (ai?.entries || [])
    .map((entry): GrowthTrajectoryEntry | null => {
      const source = bySource.get(entry.sourceId)
      if (!source || !entry.title?.trim() || !entry.summary?.trim()) return null
      return {
        entryId: `${source.id}:${hash.slice(0, 8)}`,
        occurredAt: source.occurredAt,
        title: short(entry.title, 36),
        summary: short(entry.summary, 220),
        sourceTypes: [source.sourceType],
        sourceIds: [source.sourceId],
        relatedTaskIds: source.relatedTaskIds,
        relatedRehearsalIds: source.relatedRehearsalIds,
      }
    })
    .filter((entry): entry is GrowthTrajectoryEntry => entry !== null)
    .slice(0, 80)

  const fallbackEntries: GrowthTrajectoryEntry[] = candidates.slice(0, 12).map((source) => ({
    entryId: `${source.id}:${hash.slice(0, 8)}`,
    occurredAt: source.occurredAt,
    title: source.sourceType,
    summary: short(source.text, 160),
    sourceTypes: [source.sourceType],
    sourceIds: [source.sourceId],
    relatedTaskIds: source.relatedTaskIds,
    relatedRehearsalIds: source.relatedRehearsalIds,
  }))

  const snapshot: GrowthTrajectorySnapshot = {
    sourceHash: hash,
    summary: short(
      ai?.summary || '系统会把交流、任务反馈和预演中的关键变化，慢慢整理成这条成长轨迹。',
      180
    ),
    entries: entries.length ? entries : fallbackEntries,
    updatedAt: new Date().toISOString(),
  }
  await saveGrowthTrajectorySnapshot(snapshot, tenant)
}
