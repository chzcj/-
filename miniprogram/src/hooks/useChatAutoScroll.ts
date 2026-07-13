import { useCallback, useEffect, useRef, useState } from 'react'
import type { BaseEventOrig } from '@tarojs/components'
import type { ScrollViewProps } from '@tarojs/components/types/ScrollView'

const BOTTOM_THRESHOLD = 80
const ANCHOR_ID = 'chat-scroll-anchor'

export function useChatAutoScroll(triggerDeps: unknown[]) {
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

    // 只用 scrollIntoView，避免与 scrollTop 双驱动打架
    setScrollIntoView('')
    requestAnimationFrame(() => {
      if (tick !== scrollTickRef.current) return
      setScrollIntoView(ANCHOR_ID)
    })
    setTimeout(() => {
      if (tick !== scrollTickRef.current) return
      setScrollIntoView('')
      requestAnimationFrame(() => {
        if (tick !== scrollTickRef.current) return
        setScrollIntoView(ANCHOR_ID)
      })
    }, 120)
  }, [])

  const resumeFollowOnSend = useCallback(() => {
    autoFollowRef.current = true
    scrollToBottom(true)
  }, [scrollToBottom])

  useEffect(() => {
    if (!autoFollowRef.current) return
    scrollToBottom(true)
    const late = setTimeout(() => scrollToBottom(true), 280)
    return () => clearTimeout(late)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, triggerDeps)

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
    anchorId: ANCHOR_ID,
    setViewHeight,
  }
}
