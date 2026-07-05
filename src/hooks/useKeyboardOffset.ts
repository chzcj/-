'use client'

import { useEffect } from 'react'

/**
 * iOS/Android 软键盘：对齐 design-reference/2-main-app.html
 * baseViewportHeight + visualViewport 计算 --keyboard-offset，底栏 translateY；
 * 不用 body position:fixed，避免 Safari 顶页留缝。
 */
export function useKeyboardOffset() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const vv = window.visualViewport
    let baseViewportHeight = window.innerHeight

    function isTextEditing() {
      const active = document.activeElement
      return !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    }

    function clear() {
      baseViewportHeight = Math.max(baseViewportHeight, window.innerHeight)
      document.documentElement.style.setProperty('--keyboard-offset', '0px')
      document.body.classList.remove('keyboard-open')
    }

    function update() {
      if (!isTextEditing()) {
        clear()
        return
      }

      const currentHeight = vv.height
      const currentTop = vv.offsetTop
      const offset = Math.max(0, baseViewportHeight - currentHeight - currentTop)
      document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`)
      document.body.classList.toggle('keyboard-open', offset > 80)
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('focusin', update)
    window.addEventListener('focusout', () => {
      window.setTimeout(update, 80)
    })

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('focusin', update)
      clear()
    }
  }, [])
}
