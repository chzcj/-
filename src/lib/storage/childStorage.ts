import { DEFAULT_CHILD_ID } from './storageSeed'
import { getStorage, updateStorage } from './localStorageService'

const INTRO_SEEN_KEY = 'childos_build_intro_seen'
const BASIC_INFO_KEY = 'childos_basic_info_done'

export function getActiveChild() {
  const storage = getStorage()
  const childId = storage.activeChildId || DEFAULT_CHILD_ID
  return storage.children.find((c) => c.id === childId) ?? storage.children[0] ?? null
}

export function getChildDisplayName() {
  const child = getActiveChild()
  const nickname = child?.nickname?.trim()
  return nickname && nickname !== '孩子' ? nickname : '孩子'
}

/** 头像与标题用：避免 emoji 昵称把顶栏撑坏 */
export function getChildAvatarLetter() {
  const name = getChildDisplayName()
  const match = name.match(/[\u4e00-\u9fffA-Za-z0-9]/)
  return match?.[0] || '孩'
}

export function hasSeenBuildIntro(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markBuildIntroSeen() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function isBasicInfoComplete(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (localStorage.getItem(BASIC_INFO_KEY) === '1') return true
  } catch {
    /* ignore */
  }
  const child = getActiveChild()
  return Boolean(child?.nickname?.trim() && child?.grade?.trim())
}

export function markBasicInfoComplete() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(BASIC_INFO_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** 远端画像回灌后，同步 intro/basic 标记，避免老用户重复走前置步 */
export function syncBuildFlagsFromProfile() {
  markBuildIntroSeen()
  markBasicInfoComplete()
}

export function saveChildBasicInfo(input: { nickname: string; grade: string; age?: number }) {
  const nickname = input.nickname.trim()
  const grade = input.grade.trim()
  const now = new Date().toISOString()
  updateStorage((current) => ({
    ...current,
    children: current.children.map((child) =>
      child.id === (current.activeChildId || DEFAULT_CHILD_ID)
        ? {
            ...child,
            nickname: nickname || child.nickname,
            grade,
            age: input.age ?? child.age,
            updatedAt: now,
          }
        : child
    ),
  }))
  markBasicInfoComplete()
}
