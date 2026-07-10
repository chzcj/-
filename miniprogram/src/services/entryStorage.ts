import Taro from '@tarojs/taro'
import {
  ensureModule,
  loadBuildState,
  saveBuildState,
  type BuildEntryType,
  type BuildModuleState,
  type BuildState,
} from '@/services/buildState'

export type EntryFollowUpGate = {
  shouldAsk: boolean
  purpose?: string
  directions?: string[]
  voicePrompt?: string
}

export type StageSummaryData = {
  mainJudgment: string
  facts: string[]
  pendingHypotheses: string[]
}

const GATE_KEY = 'yujian_entry_gate'

function invalidateStageSummary(m: BuildModuleState) {
  m.stageSummary = ''
  m.aiFacts = []
  m.aiHypotheses = []
  m.moduleComplete = false
}

export function getCombinedEntryText(entryType: BuildEntryType): string {
  const state = loadBuildState()
  const m = state.entryMap[entryType]
  if (!m) return ''
  return [...m.rawTexts, ...m.followUps].join('\n\n').trim()
}

export function saveCaptureText(entryType: BuildEntryType, text: string) {
  const state = loadBuildState()
  const m = ensureModule(state, entryType)
  if (!m.rawTexts.length) m.rawTexts = [text.trim()]
  else m.rawTexts[0] = text.trim()
  invalidateStageSummary(m)
  saveBuildState(state)
}

export function appendFollowUpText(entryType: BuildEntryType, text: string) {
  const state = loadBuildState()
  const m = ensureModule(state, entryType)
  m.followUps.push(text.trim())
  invalidateStageSummary(m)
  saveBuildState(state)
}

export function getFollowUpCount(entryType: BuildEntryType): number {
  const state = loadBuildState()
  return state.entryMap[entryType]?.followUps.length ?? 0
}

export function getLatestStageSummary(entryType: BuildEntryType): StageSummaryData | null {
  const m = loadBuildState().entryMap[entryType]
  if (!m?.stageSummary) return null
  return {
    mainJudgment: m.stageSummary,
    facts: m.aiFacts || [],
    pendingHypotheses: m.aiHypotheses || [],
  }
}

export function saveStageSummary(entryType: BuildEntryType, data: StageSummaryData) {
  const state = loadBuildState()
  const m = ensureModule(state, entryType)
  m.stageSummary = data.mainJudgment
  m.aiFacts = data.facts
  m.aiHypotheses = data.pendingHypotheses
  saveBuildState(state)
}

export function confirmModuleComplete(entryType: BuildEntryType) {
  const state = loadBuildState()
  const m = ensureModule(state, entryType)
  m.moduleComplete = true
  saveBuildState(state)
}

export function getEntryStatus(entryType: BuildEntryType): 'not_started' | 'in_progress' | 'completed' {
  const state = loadBuildState()
  const m = state.entryMap[entryType]
  if (!m) return 'not_started'
  if (m.moduleComplete) return 'completed'
  if (m.rawTexts.length || m.followUps.length || m.stageSummary) return 'in_progress'
  return 'not_started'
}

export function getAllEntryStatuses(): Record<BuildEntryType, 'not_started' | 'in_progress' | 'completed'> {
  return {
    daily: getEntryStatus('daily'),
    homework: getEntryStatus('homework'),
    communication: getEntryStatus('communication'),
    family: getEntryStatus('family'),
  }
}

export function saveEntryGate(entryType: BuildEntryType, gate: EntryFollowUpGate) {
  try {
    const raw = Taro.getStorageSync(GATE_KEY)
    const map = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
    map[entryType] = gate
    Taro.setStorageSync(GATE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function loadEntryGate(entryType: BuildEntryType): EntryFollowUpGate | null {
  try {
    const raw = Taro.getStorageSync(GATE_KEY)
    const map = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
    return map[entryType] || null
  } catch {
    return null
  }
}

export function clearEntryGate(entryType: BuildEntryType) {
  const gate = loadEntryGate(entryType)
  if (!gate) return
  try {
    const raw = Taro.getStorageSync(GATE_KEY)
    const map = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
    delete map[entryType]
    Taro.setStorageSync(GATE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function allModulesCompleted(state?: BuildState): boolean {
  const st = state || loadBuildState()
  return (['daily', 'homework', 'communication', 'family'] as BuildEntryType[]).every((k) => {
    const m = st.entryMap[k]
    return Boolean(m?.moduleComplete)
  })
}

/** 对齐 Web canAccessProfileGenerating：四模块已确认 + 已提交收尾追问 */
export function canAccessProfileGenerating(state?: BuildState): boolean {
  if (!allModulesCompleted(state)) return false
  const finalText = (state || loadBuildState()).finalFollowUpText?.trim() || ''
  return finalText.length >= 20
}
