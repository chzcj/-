/** 小程序好友转发文案与路径（不含用户隐私参数） */

export const SHARE_DEFAULT_TITLE = '育见 - 帮家长看见孩子，而不是只看见问题'

export const SHARE_PATHS = {
  login: '/pages/login/index',
  daily: '/pages/daily/index',
  tasks: '/pages/tasks/index',
  rehearsal: '/pages/rehearsal/index',
  profile: '/pages/profile/index',
  profileDeep: '/pages/profile/deep/index',
  profileEvidence: '/pages/profile/evidence/index',
  profileVerify: '/pages/profile/verify/index',
} as const

/** 画像卡片 slug 白名单（仅类型名，非用户数据） */
export const SHAREABLE_CARD_SLUGS = new Set([
  'growth',
  'focus',
  'behavior',
  'interaction',
  'strategies',
  'hypotheses',
  'tensions',
])

export function buildProfileCardSharePath(slug: string): string {
  const normalized = slug.trim()
  if (normalized && SHAREABLE_CARD_SLUGS.has(normalized)) {
    return `/pages/profile/card/index?id=${encodeURIComponent(normalized)}`
  }
  return SHARE_PATHS.profile
}
