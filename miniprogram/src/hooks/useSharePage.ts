import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { SHARE_DEFAULT_TITLE, SHARE_PATHS } from '@/lib/shareMessages'

export type SharePageConfig = {
  title?: string
  path: string
}

function resolveConfig(config: SharePageConfig | (() => SharePageConfig)): SharePageConfig {
  return typeof config === 'function' ? config() : config
}

function pathToTimelineQuery(path: string): string {
  const normalized = path.replace(/^\//, '')
  const idx = normalized.indexOf('?')
  return idx >= 0 ? normalized.slice(idx + 1) : ''
}

/** 公开页：好友转发 + 朋友圈 */
export function usePublicPageShare(config: SharePageConfig | (() => SharePageConfig)) {
  useDidShow(() => {
    void Taro.showShareMenu({
      withShareTicket: false,
      menus: ['shareAppMessage', 'shareTimeline'],
    } as Taro.showShareMenu.Option)
  })

  useShareAppMessage(() => {
    const resolved = resolveConfig(config)
    return {
      title: resolved.title || SHARE_DEFAULT_TITLE,
      path: resolved.path,
    }
  })

  useShareTimeline(() => {
    const resolved = resolveConfig(config)
    return {
      title: resolved.title || SHARE_DEFAULT_TITLE,
      query: pathToTimelineQuery(resolved.path),
    }
  })
}

/** @deprecated 使用 usePublicPageShare */
export function useEnableShareAppMessage(
  config: SharePageConfig | (() => SharePageConfig)
) {
  usePublicPageShare(config)
}

/** 私密页：菜单仍显示转发，落地安全页（不带隐私 query） */
export function useSafeShareAppMessage(
  config?: Omit<SharePageConfig, 'path'> | (() => Omit<SharePageConfig, 'path'>)
) {
  useDidShow(() => {
    void Taro.showShareMenu({
      withShareTicket: false,
      menus: ['shareAppMessage', 'shareTimeline'],
    } as Taro.showShareMenu.Option)
  })

  useShareAppMessage(() => {
    const resolved = typeof config === 'function' ? config() : config
    return {
      title: resolved?.title || SHARE_DEFAULT_TITLE,
      path: SHARE_PATHS.login,
    }
  })

  useShareTimeline(() => ({
    title:
      (typeof config === 'function' ? config()?.title : config?.title) || SHARE_DEFAULT_TITLE,
    query: '',
  }))
}

/** @deprecated 使用 useSafeShareAppMessage */
export function useDisableShareAppMessage() {
  useSafeShareAppMessage()
}
