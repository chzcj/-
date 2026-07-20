import 'server-only'

import { callFastJson, frontAiThinkingDisabled } from '@/lib/server/ark-agents'
import { promptRegistry } from '@/lib/server/prompts/registry.generated'
import type { TenantId } from '@/lib/server/memory/tenant'
import { getTurnEventByTraceId } from '@/lib/server/memory/database-manager'
import { listHighValueAtomsForTenant } from '@/lib/server/db'
import { buildMemoryFeedAll, feedTypeLabel } from '@/lib/server/profile/handbook-admission'
import { loadHandbookPage } from '@/lib/server/profile/handbook-pages-store'
import type { MemoryMomentDetail } from '@/types/handbook-pack'

async function resolveEvidenceBody(
  tenant: TenantId,
  pageId: string,
  memoryId: string,
  itemSourceRef: string,
  itemType: string,
  pageRaw?: string,
  evidenceRef?: string
): Promise<string> {
  if (pageRaw?.trim()) return pageRaw.trim()

  if (memoryId.startsWith('page:')) {
    const page = await loadHandbookPage(tenant, pageId)
    if (page?.rawEvidence?.trim()) return page.rawEvidence.trim()
    if (page?.source === 'rehearsal_voice' && page.evidenceRef) {
      const turn = await getTurnEventByTraceId(tenant, page.evidenceRef)
      if (turn?.userMessage) return turn.userMessage
    }
    if (page?.source === 'episode_atom' && page.sourceRef) {
      const atoms = await listHighValueAtomsForTenant(tenant.familyId, tenant.childId, 80)
      const atom = atoms.find((a) => a.atomId === page.sourceRef)
      if (atom?.content) return atom.content
    }
  }

  if (memoryId.startsWith('turn:')) {
    const turn = await getTurnEventByTraceId(tenant, memoryId.slice(5))
    if (turn?.userMessage) return turn.userMessage
  }

  if (evidenceRef && itemType === 'voice') {
    const turn = await getTurnEventByTraceId(tenant, evidenceRef)
    if (turn?.userMessage) return turn.userMessage
  }

  const atoms = await listHighValueAtomsForTenant(tenant.familyId, tenant.childId, 50)
  const atom = atoms.find((a) => a.atomId === itemSourceRef)
  if (atom?.content) return atom.content

  return ''
}

export async function buildMemoryMomentDetail(
  tenant: TenantId,
  memoryId: string
): Promise<MemoryMomentDetail | null> {
  const feed = await buildMemoryFeedAll(tenant, 500)
  const item = feed.find((f) => f.id === memoryId)
  if (!item) return null

  const pageId = memoryId.startsWith('page:') ? memoryId.slice(5) : ''
  const page = pageId ? await loadHandbookPage(tenant, pageId) : null

  const evidenceBody = await resolveEvidenceBody(
    tenant,
    pageId,
    memoryId,
    item.sourceRef,
    item.type,
    page?.rawEvidence,
    page?.evidenceRef
  )

  const whyIncluded = page?.whyIncluded || item.whyIncluded
  const kicker = `${feedTypeLabel(item.type)} · ${new Date(item.occurredAt).getMonth() + 1}月${new Date(item.occurredAt).getDate()}日`
  const title = item.displayLine || item.title || item.keyword

  const llmBody = [evidenceBody, page?.contextSummary].filter(Boolean).join('\n\n')

  const llm = await callFastJson<{ interpretation?: string; keyQuotes?: string[] }>(
    [promptRegistry.parentFacingStyle, promptRegistry.memoryMomentLight].join('\n\n---\n\n'),
    {
      type: item.type,
      body: llmBody || whyIncluded || item.snippet,
      keyword: item.keyword,
      snippet: item.displayLine || item.snippet,
      whyIncluded,
    },
    { maxTokens: 1024, disableThinking: frontAiThinkingDisabled() }
  ).catch(() => undefined)

  const lead =
    item.type === 'shine'
      ? '这句被标为闪光时刻——值得在手账里回看。'
      : item.type === 'voice'
        ? '先听原声，再看提炼的关键句——纪念感在前，分析在后。'
        : page?.contextSummary?.slice(0, 80) || undefined

  return {
    item,
    kicker,
    title,
    lead,
    whyIncluded,
    evidenceBody: evidenceBody || undefined,
    body: whyIncluded,
    keyQuotes: llm?.keyQuotes?.slice(0, 3),
    interpretation: llm?.interpretation?.trim().slice(0, 200),
    playUrl: null,
  }
}
