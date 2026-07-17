import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '@/config/env'
import { apiRequest, getSessionToken } from '@/services/api'

export type BuildEntryType = 'daily' | 'homework' | 'communication' | 'family'

export type BuildModuleState = {
  rawTexts: string[]
  followUps: string[]
  stageSummary: string
  aiFacts: string[]
  aiHypotheses: string[]
  /** 用户点击「继续下一模块」后为 true，对齐 Web markEntryCompleted */
  moduleComplete?: boolean
  /** S3：材料是否足以形成有效模块理解 */
  summarySufficient?: boolean
  familyMap?: string
  summarySections?: Array<{ title: string; body: string }>
}

export type BuildState = {
  entryMap: Partial<Record<BuildEntryType, BuildModuleState>>
  finalFollowUpText?: string
  /** 最后补充可以为空；单独记录“用户已确认提交”避免把空值误当成未完成。 */
  finalFollowUpSubmitted?: boolean
  currentModule?: BuildEntryType
}

const EMPTY_MODULE = (): BuildModuleState => ({
  rawTexts: [],
  followUps: [],
  stageSummary: '',
  aiFacts: [],
  aiHypotheses: [],
})

export function loadBuildState(): BuildState {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEYS.buildState)
    if (!raw) return { entryMap: {} }
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return { entryMap: {} }
  }
}

export function saveBuildState(state: BuildState) {
  Taro.setStorageSync(STORAGE_KEYS.buildState, JSON.stringify(state))
  void syncBuildProgressToServer()
}

export async function syncBuildProgressToServer(flags?: {
  introSeen?: boolean
  basicInfoDone?: boolean
}): Promise<void> {
  if (!getSessionToken()) return
  const state = loadBuildState()
  const completedEntries = BUILD_MODULES.filter((mod) => {
    const m = state.entryMap[mod.key]
    return Boolean(m?.moduleComplete)
  }).map((mod) => mod.key)

  const stageSummaries = BUILD_MODULES.map((mod) => {
    const m = state.entryMap[mod.key]
    if (!m?.stageSummary) return null
    return {
      entryType: mod.key,
      mainJudgment: m.stageSummary,
      facts: m.aiFacts || [],
      pendingHypotheses: m.aiHypotheses || [],
      familyMap: m.familyMap,
      sufficient: m.summarySufficient,
    }
  }).filter(Boolean)

  const { isBasicInfoComplete } = await import('@/services/childStorage')
  const { hasIntroSeen } = await import('@/services/onboardingFlags')
  await apiRequest('/api/profile/build-state', {
    method: 'POST',
    data: {
      introSeen: flags?.introSeen ?? hasIntroSeen(),
      basicInfoDone: flags?.basicInfoDone ?? isBasicInfoComplete(),
      completedEntries,
      stageSummaries,
    },
  })
}

export async function hydrateBuildStateFromServer(): Promise<BuildState> {
  const res = await apiRequest<{
    state?: {
      introSeen?: boolean
      completedEntries?: string[]
      stageSummaries?: Array<{
        entryType: string
        mainJudgment?: string
        facts?: string[]
        pendingHypotheses?: string[]
      }>
    } | null
  }>('/api/profile/build-state', { method: 'GET' })

  const local = loadBuildState()
  const remote = res.ok ? res.data.state : null
  if (!remote) return local

  if (remote.introSeen || (remote.completedEntries || []).length > 0) {
    const { markIntroSeen } = await import('@/services/onboardingFlags')
    markIntroSeen()
  }

  const next: BuildState = { ...local, entryMap: { ...local.entryMap } }
  for (const summary of remote.stageSummaries || []) {
    const key = summary.entryType as BuildEntryType
    if (!BUILD_MODULES.some((m) => m.key === key)) continue
    const m = ensureModule(next, key)
    m.stageSummary = summary.mainJudgment || m.stageSummary
    m.aiFacts = summary.facts || m.aiFacts
    m.aiHypotheses = summary.pendingHypotheses || m.aiHypotheses
  }
  for (const entry of remote.completedEntries || []) {
    const key = entry as BuildEntryType
    if (!BUILD_MODULES.some((m) => m.key === key)) continue
    ensureModule(next, key).moduleComplete = true
  }
  saveBuildState(next)
  return next
}

export function ensureModule(state: BuildState, entryType: BuildEntryType): BuildModuleState {
  if (!state.entryMap[entryType]) state.entryMap[entryType] = EMPTY_MODULE()
  return state.entryMap[entryType]!
}

export const BUILD_MODULES: { key: BuildEntryType; title: string; hint: string }[] = [
  { key: 'daily', title: '日常节奏', hint: '手机、作息、一天怎么过' },
  { key: 'homework', title: '学习作业', hint: '作业流程、检查、订正' },
  { key: 'communication', title: '亲子沟通', hint: '冲突原话、怎么升级' },
  { key: 'family', title: '家庭支持', hint: '谁主盯、试过什么' },
]
