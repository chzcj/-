import 'server-only'

import { callFastJson, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { promptRegistry } from '@/lib/server/prompts/registry.generated'
import type { TenantId } from '@/lib/server/memory/tenant'
import {
  getTurnEventByTraceId,
  getUserTaskById,
} from '@/lib/server/memory/database-manager'
import { listHighValueAtomsForTenant } from '@/lib/server/db'
import { feedTypeLabel } from '@/lib/server/profile/handbook-admission'
import { handbookPageToFeedItem } from '@/lib/profile/handbook-feed-map'
import { loadHandbookPage, saveHandbookPage } from '@/lib/server/profile/handbook-pages-store'
import { loadDailyUiSnapshot } from '@/lib/server/profile/daily-refresh-agent'
import type { HandbookPage, MemoryMomentDetail } from '@/types/handbook-pack'

function looksLikeGenericSummary(text: string): boolean {
  const t = text.trim()
  if (t.length < 8) return true
  if (/本周出现|记录下当前|还在整理|缺少可溯源/.test(t)) return true
  if (/^(交流|预演|任务反馈|画像更新)/.test(t) && t.length < 20) return true
  return false
}

async function resolveEvidenceBody(
  tenant: TenantId,
  page: HandbookPage | null,
  memoryId: string,
  itemSourceRef: string,
  itemType: string
): Promise<string> {
  const stored = page?.rawEvidence?.trim() || ''
  if (stored && !looksLikeGenericSummary(stored)) return stored

  if (page?.source === 'rehearsal_voice' && page.evidenceRef) {
    const turn = await getTurnEventByTraceId(tenant, page.evidenceRef)
    if (turn?.userMessage?.trim()) return turn.userMessage.trim()
  }

  if (page?.source === 'episode_atom' && page.sourceRef) {
    const atoms = await listHighValueAtomsForTenant(tenant.familyId, tenant.childId, 80)
    const atom = atoms.find((a) => a.atomId === page.sourceRef)
    if (atom?.content?.trim()) return atom.content.trim()
  }

  if (page?.source === 'task_shine' && page.sourceRef) {
    const task = await getUserTaskById(tenant, page.sourceRef)
    const effect = task?.feedback?.effect?.trim() || ''
    const completed = task?.feedback?.completed?.trim() || ''
    const note = task?.feedback?.note?.trim() || ''
    const body = [effect || completed, note, task?.title ? `任务：${task.title}` : '']
      .filter(Boolean)
      .join('\n')
    if (body.length >= 8 && !looksLikeGenericSummary(body)) return body
  }

  if (page?.source === 'highlight_moment') {
    const snap = await loadDailyUiSnapshot(tenant).catch(() => null)
    const hl = (snap?.highlightMoments || []).find(
      (h) => h.id === page.sourceRef || h.title === page.sourceRef || h.teaser === page.sourceRef
    )
    const body = [hl?.whyHighlighted, hl?.teaser, hl?.title].filter(Boolean).join('\n')
    if (body.length >= 12 && !looksLikeGenericSummary(body)) return body
  }

  if (page?.source === 'how_to_speak' && page.evidenceRef) {
    const turn = await getTurnEventByTraceId(tenant, page.evidenceRef)
    if (turn?.userMessage?.trim()) return turn.userMessage.trim()
  }

  if (page?.source === 'journal' && page.rawEvidence?.trim()) {
    return page.rawEvidence.trim()
  }

  if (memoryId.startsWith('turn:')) {
    const turn = await getTurnEventByTraceId(tenant, memoryId.slice(5))
    if (turn?.userMessage?.trim()) return turn.userMessage.trim()
  }

  if (page?.evidenceRef && itemType === 'voice') {
    const turn = await getTurnEventByTraceId(tenant, page.evidenceRef)
    if (turn?.userMessage?.trim()) return turn.userMessage.trim()
  }

  const atoms = await listHighValueAtomsForTenant(tenant.familyId, tenant.childId, 50)
  const atom = atoms.find((a) => a.atomId === itemSourceRef)
  if (atom?.content?.trim() && !looksLikeGenericSummary(atom.content)) return atom.content.trim()

  // 禁止用 displayLine / lead 冒充原文
  return ''
}

function pageIdFromMemoryId(memoryId: string): string {
  return memoryId.startsWith('page:') ? memoryId.slice(5) : memoryId
}

/**
 * 记忆详情：按 pageId 直读，禁止扫全量 feed。
 * interpretation/keyQuotes 有缓存则跳过 LLM。
 */
export async function buildMemoryMomentDetail(
  tenant: TenantId,
  memoryId: string
): Promise<MemoryMomentDetail | null> {
  const pageId = pageIdFromMemoryId(memoryId)
  const page = await loadHandbookPage(tenant, pageId)
  if (!page) return null

  const item = handbookPageToFeedItem(page)
  const evidenceBody = await resolveEvidenceBody(
    tenant,
    page,
    memoryId.startsWith('page:') ? memoryId : `page:${pageId}`,
    item.sourceRef,
    item.type
  )

  // 回写溯源成功的 rawEvidence，供下次与 Top3
  if (evidenceBody && (!page.rawEvidence?.trim() || looksLikeGenericSummary(page.rawEvidence))) {
    await saveHandbookPage(tenant, { ...page, rawEvidence: evidenceBody }).catch(() => undefined)
  }

  const whyIncluded = page.whyIncluded || item.whyIncluded
  const kicker = `${feedTypeLabel(item.type)} · ${new Date(item.occurredAt).getMonth() + 1}月${new Date(item.occurredAt).getDate()}日`
  const title = item.displayLine || item.title || item.keyword

  const lead =
    item.type === 'shine'
      ? '这句被标为闪光时刻——值得在手账里回看。'
      : item.type === 'voice'
        ? '先听原声，再看提炼的关键句——纪念感在前，分析在后。'
        : page.contextSummary?.slice(0, 80) || undefined

  let keyQuotes = page.keyQuotesCached?.slice(0, 3)
  let interpretation = page.interpretationCached?.trim().slice(0, 200)

  const needLlm = Boolean(evidenceBody) && (!interpretation || !keyQuotes?.length)
  if (needLlm) {
    const llmBody = [evidenceBody, page.contextSummary].filter(Boolean).join('\n\n')
    const llm = await callFastJson<{ interpretation?: string; keyQuotes?: string[] }>(
      [promptRegistry.parentFacingStyle, promptRegistry.memoryMomentLight].join('\n\n---\n\n'),
      {
        type: item.type,
        body: llmBody,
        keyword: item.keyword,
        snippet: item.displayLine || item.snippet,
        whyIncluded,
      },
      { maxTokens: 1024, disableThinking: frontAiThinkingDisabled() }
    ).catch(() => undefined)

    interpretation = llm?.interpretation?.trim().slice(0, 200) || interpretation
    keyQuotes = llm?.keyQuotes?.slice(0, 3) || keyQuotes

    if (interpretation || keyQuotes?.length) {
      await saveHandbookPage(tenant, {
        ...page,
        rawEvidence: evidenceBody || page.rawEvidence,
        interpretationCached: interpretation,
        keyQuotesCached: keyQuotes,
        lightCachedAt: new Date().toISOString(),
      }).catch(() => undefined)
    }
  }

  // 无原话时：不把 whyIncluded / displayLine 塞进 evidenceBody
  const quotes =
    keyQuotes?.filter((q) => q.trim() && q.trim() !== evidenceBody?.trim()).slice(0, 3) || undefined

  return {
    item: { ...item, hasRawEvidence: Boolean(evidenceBody) },
    kicker,
    title,
    lead,
    whyIncluded,
    evidenceBody: evidenceBody || undefined,
    body: whyIncluded,
    keyQuotes: quotes,
    interpretation,
    playUrl: null,
  }
}
