'use client'

import { startTransition, useCallback, useEffect, useRef } from 'react'

/** rAF 合并流式更新，降低 React 重渲染频率 */
export function useStreamBuffer<T>(flush: (value: T) => void) {
  const pendingRef = useRef<T | null>(null)
  const rafRef = useRef<number | null>(null)

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    pendingRef.current = null
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pendingRef.current = value
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const next = pendingRef.current
        pendingRef.current = null
        if (next === null) return
        startTransition(() => flush(next))
      })
    },
    [flush]
  )

  const flushNow = useCallback(() => {
    const next = pendingRef.current
    cancel()
    if (next !== null) flush(next)
  }, [cancel, flush])

  useEffect(() => () => cancel(), [cancel])

  return { schedule, flushNow, cancel }
}
