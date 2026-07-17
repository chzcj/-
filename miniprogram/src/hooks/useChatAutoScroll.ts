import { useCallback, useEffect, useRef, useState } from 'react'
import type { BaseEventOrig } from '@tarojs/components'
import type { ScrollViewProps } from '@tarojs/components/types/ScrollView'

const BOTTOM_THRESHOLD = 80
export const CHAT_SCROLL_ANCHOR_A = 'chat-scroll-anchor-a'
export const CHAT_SCROLL_ANCHOR_B = 'chat-scroll-anchor-b'

type UseChatAutoScrollOptions = {
  /** 为 false 时不自动跟滚（如交流页等 thread hydrate 完成） */
  enabled?: boolean
}

export function useChatAutoScroll(triggerDeps: unknown[], options?: UseChatAutoScrollOptions) {
  const enabled = options?.enabled !== false
  const [scrollIntoView, setScrollIntoView] = useState('')
  const autoFollowRef = useRef(true)
  const viewHeightRef = useRef(0)
  const scrollTickRef = useRef(0)

  const scrollToBottom = useCallback((force = false) => {
    if (!force && !autoFollowRef.current) return
    if (force) {
      autoFollowRef.current = true
    }
    scrollTickRef.current += 1
    const tick = scrollTickRef.current

    // 双 anchor 交替：禁止 setScrollIntoView('')，微信端清空会闪回 scrollTop=0
    const primary = tick % 2 === 0 ? CHAT_SCROLL_ANCHOR_A : CHAT_SCROLL_ANCHOR_B
    setScrollIntoView(primary)
    setTimeout(() => {
      if (tick !== scrollTickRef.current) return
      const secondary = primary === CHAT_SCROLL_ANCHOR_A ? CHAT_SCROLL_ANCHOR_B : CHAT_SCROLL_ANCHOR_A
      setScrollIntoView(secondary)
    }, 120)
  }, [])

  const resumeFollowOnSend = useCallback(() => {
    autoFollowRef.current = true
    scrollToBottom(true)
  }, [scrollToBottom])

  useEffect(() => {
    if (!enabled || !autoFollowRef.current) return
    scrollToBottom(true)
    const late = setTimeout(() => scrollToBottom(true), 280)
    return () => clearTimeout(late)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...triggerDeps, enabled])

  const onScroll = useCallback((e: BaseEventOrig<ScrollViewProps.onScrollDetail>) => {
    const { scrollTop: top, scrollHeight } = e.detail
    const viewHeight = viewHeightRef.current
    if (viewHeight <= 0) return
    const distFromBottom = scrollHeight - top - viewHeight
    if (distFromBottom > BOTTOM_THRESHOLD) {
      autoFollowRef.current = false
    } else {
      autoFollowRef.current = true
    }
  }, [])

  const setViewHeight = useCallback((height: number) => {
    viewHeightRef.current = height
  }, [])

  return {
    scrollIntoView,
    scrollTop: undefined as number | undefined,
    onScroll,
    scrollToBottom,
    resumeFollowOnSend,
    anchorId: CHAT_SCROLL_ANCHOR_A,
    anchorAltId: CHAT_SCROLL_ANCHOR_B,
    setViewHeight,
  }
}
