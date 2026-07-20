import { shouldSkipEpisodeIngest } from '@/lib/server/memory/episode/ingest-gate'
import type { HandbookAdmissionSource } from '@/types/handbook-pack'

const GENERIC_TRAJECTORY_TITLES = new Set(['交流', '预演', '任务反馈', '画像更新'])
const MEANINGLESS_RE = /无意义|收到无意义|测试输入|^测试$/iu
const STATS_HIGHLIGHT_RE = /交流了?\s*\d+\s*次/u

export type HandbookQualityMeta = {
  titleHint?: string
  atomSourceType?: string
  taskEffect?: string
  taskCompleted?: string
}

export function isGenericTrajectoryTitle(text: string): boolean {
  return GENERIC_TRAJECTORY_TITLES.has(text.trim())
}

/** 手账准入质量门：与 episode ingest 对齐，并加源专属规则 */
export function shouldSkipHandbookAdmission(
  source: HandbookAdmissionSource,
  rawEvidence: string,
  meta: HandbookQualityMeta = {}
): boolean {
  const raw = rawEvidence?.trim() || ''
  if (!raw) return true
  if (MEANINGLESS_RE.test(raw)) return true

  if (source !== 'trajectory_hard' && shouldSkipEpisodeIngest(raw)) return true
  if (raw.length < 12 && source !== 'highlight_moment') return true

  if (source === 'trajectory_hard') {
    if (isGenericTrajectoryTitle(raw)) return true
    if (raw.length < 16) return true
  }

  if (source === 'highlight_moment' && STATS_HIGHLIGHT_RE.test(raw)) return true

  if (source === 'task_shine') {
    const effect = (meta.taskEffect || '').trim()
    const completed = (meta.taskCompleted || '').trim()
    const substance = effect || completed
    if (substance.length < 8) return true
    if (/^(好|挺好的|不错|完成|完成了)[\s!！。]*$/u.test(substance)) return true
  }

  if (source === 'episode_atom') {
    if (meta.atomSourceType === 'parent_inferred' && raw.length < 20) return true
  }

  return false
}

/** 已落库页是否应 purge */
export function isBadHandbookPage(displayLine: string, rawEvidence?: string, source?: HandbookAdmissionSource): boolean {
  const line = displayLine?.trim() || ''
  const raw = rawEvidence?.trim() || line
  if (!line) return true
  if (MEANINGLESS_RE.test(line) || MEANINGLESS_RE.test(raw)) return true
  if (isGenericTrajectoryTitle(line)) return true
  if (/^(交流|预演|任务反馈|画像更新|任务反馈本周出现|记录下当前状态)$/u.test(line)) return true
  if (/本周出现|本周新增|还在积累/u.test(line) && line.length < 18) return true
  if (source && shouldSkipHandbookAdmission(source, raw || line)) return true
  return false
}

export function polishHasInformationGain(rawEvidence: string, displayLine: string): boolean {
  const raw = rawEvidence.trim()
  const line = displayLine.trim()
  if (!line || line.length < 8 || line.length > 28) return false
  if (raw.slice(0, 24) === line.slice(0, 24)) return false
  return true
}

export function validatePolishedOutput(
  rawEvidence: string,
  out: { displayLine?: string; whyIncluded?: string; teaser?: string }
): boolean {
  const displayLine = out.displayLine?.trim() || ''
  const whyIncluded = out.whyIncluded?.trim() || ''
  if (!polishHasInformationGain(rawEvidence, displayLine)) return false
  if (whyIncluded.length < 20 || whyIncluded.length > 88) return false
  if (MEANINGLESS_RE.test(displayLine) || MEANINGLESS_RE.test(whyIncluded)) return false
  const teaser = out.teaser?.trim()
  if (teaser && teaser === displayLine) return false
  return true
}
