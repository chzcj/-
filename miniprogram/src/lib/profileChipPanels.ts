import Taro from '@tarojs/taro'
import { apiRequest } from '@/services/api'

/** 画像展示层 chip 面板（与 BFF daily_ui_snapshot.chipPanels 对齐） */
export type ChipEvidenceItem = {
  sourceLabel: string
  evidenceText: string
  explanation?: string
  strength?: string
}

export type ChipObservationPoint = {
  title: string
  description: string
}

export type FullPortraitBrief = {
  core: string
  focus: string
  completenessHint?: string
}

export type ProfileChipPanels = {
  mechanismChainParent?: string
  evidenceItems?: ChipEvidenceItem[]
  observationPoints?: ChipObservationPoint[]
  fullPortraitBrief?: FullPortraitBrief
}

const CACHE_KEY = 'yujian_profile_chip_panels_v1'

export function readCachedChipPanels(): ProfileChipPanels | null {
  try {
    const raw = Taro.getStorageSync(CACHE_KEY)
    if (!raw) return null
    return typeof raw === 'string' ? (JSON.parse(raw) as ProfileChipPanels) : (raw as ProfileChipPanels)
  } catch {
    return null
  }
}

export function writeCachedChipPanels(panels: ProfileChipPanels | null | undefined) {
  if (!panels) return
  try {
    Taro.setStorageSync(CACHE_KEY, JSON.stringify(panels))
  } catch {
    /* ignore */
  }
}

/** 拉 hub 展示层；L3 可先用缓存 */
export async function fetchChipPanelsFromHub(): Promise<{
  panels: ProfileChipPanels | null
  panelsReady: boolean
  refreshedAt: string | null
}> {
  const cached = readCachedChipPanels()
  const hub = await apiRequest<{
    chipPanels?: ProfileChipPanels | null
    panelsReady?: boolean
    refreshedAt?: string | null
  }>('/api/profile/hub', { method: 'GET' })

  if (hub.ok && hub.data.chipPanels) {
    writeCachedChipPanels(hub.data.chipPanels)
    return {
      panels: hub.data.chipPanels,
      panelsReady: Boolean(hub.data.panelsReady),
      refreshedAt: hub.data.refreshedAt || null,
    }
  }

  return {
    panels: cached,
    panelsReady: false,
    refreshedAt: null,
  }
}
