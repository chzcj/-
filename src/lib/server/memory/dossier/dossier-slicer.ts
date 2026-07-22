import 'server-only'

import type { FamilyUnderstandingDossier } from '@/types/family-understanding-dossier'
import type { InputTypeLabel } from '@/types/database'

export type DossierSlice = {
  workingHypothesis?: string
  integratedSynthesisLead?: string
  familyStructSummary?: string[]
  perpetuating?: string[]
  protective?: string[]
  sceneReadings?: string[]
  parentPerspectives?: string[]
  interventionTargets?: string[]
  alternativeReadings?: string[]
}

function firstSentence(text: string): string {
  const t = text.trim()
  if (!t) return ''
  const m = t.match(/^[^。！？.!?]+[。！？.!?]?/)
  return (m?.[0] || t.slice(0, 120)).trim()
}

export function factorLine(f: { label: string; confidence?: number; evidenceSummary?: string }): string {
  const conf = typeof f.confidence === 'number' ? `（把握约 ${Math.round(f.confidence * 100)}%）` : ''
  const ev = f.evidenceSummary ? ` — ${f.evidenceSummary}` : ''
  return `${f.label}${conf}${ev}`.trim()
}

/** 置信度最高的一条备择解释——日常对话也下发，防止主假设成为所有回答的引力中心 */
export function topAlternativeReading(dossier: FamilyUnderstandingDossier): string[] | undefined {
  const alts = (dossier.alternativeReadings || [])
    .filter((a) => a.hypothesis?.trim())
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  if (alts.length === 0) return undefined
  const top = alts[0]
  return [`${top.hypothesis}（${Math.round((top.confidence || 0) * 100)}%）`]
}

export function sliceForDaily(query: string, dossier: FamilyUnderstandingDossier | null | undefined): DossierSlice {
  if (!dossier?.workingHypothesis?.text) return {}
  const q = query.trim()
  const base: DossierSlice = {
    workingHypothesis: dossier.workingHypothesis.text,
    integratedSynthesisLead: firstSentence(dossier.integratedSynthesis || ''),
    alternativeReadings: topAlternativeReading(dossier),
  }

  if (/怎么办|怎么弄|有什么办法|建议/.test(q)) {
    return {
      ...base,
      interventionTargets: dossier.interventionTargets.slice(0, 3).map((t) => t.action),
      sceneReadings: dossier.sceneReadings.slice(0, 2).map((s) => `${s.scene}：${s.reading}`),
    }
  }

  if (/我|家长|是不是我|管太多|我的问题/.test(q)) {
    return {
      ...base,
      parentPerspectives: dossier.parentPerspectives.slice(0, 2).map(
        (p) => `${p.role}：${p.intent || ''} → 孩子感受 ${p.childReception || '未明'}；盲点 ${p.blindSpot || '待观察'}`
      ),
      integratedSynthesisLead: firstSentence(dossier.integratedSynthesis || ''),
    }
  }

  return {
    ...base,
    familyStructSummary: dossier.familyStruct.slice(0, 3).map(factorLine),
    perpetuating: (dossier.fivePs.perpetuating || []).slice(0, 2).map(factorLine),
  }
}

export function sliceForRehearsal(
  sceneHint: string | undefined,
  dossier: FamilyUnderstandingDossier | null | undefined
): DossierSlice {
  if (!dossier) return {}
  const scene = (sceneHint || '').trim()
  const readings = scene
    ? dossier.sceneReadings.filter((s) => s.scene.includes(scene) || scene.includes(s.scene))
    : dossier.sceneReadings
  return {
    protective: (dossier.fivePs.protective || []).slice(0, 4).map(factorLine),
    perpetuating: (dossier.fivePs.perpetuating || []).slice(0, 3).map(factorLine),
    sceneReadings: (readings.length ? readings : dossier.sceneReadings).slice(0, 2).map((s) => s.reading),
  }
}

export function sliceForProfile(dossier: FamilyUnderstandingDossier | null | undefined): DossierSlice {
  if (!dossier) return {}
  return {
    familyStructSummary: dossier.familyStruct.map(factorLine),
    workingHypothesis: dossier.workingHypothesis.text,
    interventionTargets: dossier.interventionTargets.map((t) => `${t.id}：${t.action}`),
    alternativeReadings: (dossier.alternativeReadings || []).map(
      (a) => `${a.hypothesis}（${Math.round(a.confidence * 100)}%）`
    ),
  }
}

export function sliceForTasks(dossier: FamilyUnderstandingDossier | null | undefined): DossierSlice {
  if (!dossier) return {}
  return {
    interventionTargets: dossier.interventionTargets.map((t) => {
      const parts = [t.action]
      if (t.prediction) parts.push(`验证：${t.prediction}`)
      if (t.obstacle) parts.push(`障碍：${t.obstacle}`)
      return parts.join('；')
    }),
  }
}

export function sliceForInputType(
  inputType: InputTypeLabel | string | undefined,
  userText: string,
  dossier: FamilyUnderstandingDossier | null | undefined
): DossierSlice {
  if (inputType === 'ask_rehearsal' || inputType === 'ask_conflict_review') {
    return sliceForRehearsal(userText, dossier)
  }
  if (inputType === 'ask_advice') {
    return sliceForDaily('怎么办', dossier)
  }
  return sliceForDaily(userText, dossier)
}

/** 扁平化为 frontend-read-pack 的 string[] */
export function flattenDossierSlice(slice: DossierSlice): string[] {
  const lines: string[] = []
  if (slice.workingHypothesis) lines.push(`当前理解：${slice.workingHypothesis}`)
  if (slice.integratedSynthesisLead) lines.push(`整合：${slice.integratedSynthesisLead}`)
  for (const l of slice.familyStructSummary || []) lines.push(`结构：${l}`)
  for (const l of slice.perpetuating || []) lines.push(`维持因素：${l}`)
  for (const l of slice.protective || []) lines.push(`可能在保护：${l}`)
  for (const l of slice.sceneReadings || []) lines.push(`场景：${l}`)
  for (const l of slice.parentPerspectives || []) lines.push(`家长侧：${l}`)
  for (const l of slice.interventionTargets || []) lines.push(`可试方向：${l}`)
  for (const l of slice.alternativeReadings || []) lines.push(`其他可能：${l}`)
  return lines.slice(0, 24)
}

export function pickDefaultTaskTitle(dossier: FamilyUnderstandingDossier | null | undefined): string | undefined {
  const action = dossier?.interventionTargets?.[0]?.action?.trim()
  if (!action || action.length < 6) return undefined
  return action.slice(0, 48)
}
