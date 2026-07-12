import Taro from '@tarojs/taro'

const PROFILE_KEY = 'childos_profile_snapshot_v1'

export type LocalEvidenceItem = {
  id?: string
  sourceLabel: string
  evidenceText: string
  explanation?: string
  strength?: 'weak' | 'medium' | 'strong'
}

export type LocalVerificationPoint = {
  id?: string
  title: string
  description: string
}

export type LocalProfileSnapshot = {
  coreJudgment: string
  completeness: number
  supportFocus?: string
  deepMechanism?: string
  evidence?: LocalEvidenceItem[]
  verificationPoints?: LocalVerificationPoint[]
}

export function getLatestProfile(): LocalProfileSnapshot | null {
  try {
    const raw = Taro.getStorageSync(PROFILE_KEY)
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed?.coreJudgment) return null
    return parsed as LocalProfileSnapshot
  } catch {
    return null
  }
}

export function hasProfile(): boolean {
  return Boolean(getLatestProfile()?.coreJudgment?.trim())
}

export function hydrateProfileFromRemote(snapshot: LocalProfileSnapshot) {
  if (!snapshot?.coreJudgment?.trim()) return
  try {
    const prev = getLatestProfile()
    const merged: LocalProfileSnapshot = {
      ...prev,
      ...snapshot,
      evidence: snapshot.evidence ?? prev?.evidence,
      verificationPoints: snapshot.verificationPoints ?? prev?.verificationPoints,
    }
    Taro.setStorageSync(PROFILE_KEY, JSON.stringify(merged))
  } catch {
    /* ignore */
  }
}

export function saveLocalProfile(snapshot: LocalProfileSnapshot) {
  hydrateProfileFromRemote(snapshot)
}
