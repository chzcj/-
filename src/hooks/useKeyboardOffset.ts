'use client'

import { useEffect } from 'react'

/** iOS 键盘弹起时：只上移输入区，底栏始终贴屏幕底部。 */
export function useKeyboardOffset() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    let baseHeight = window.innerHeight

    function isTextEditing() {
      const active = document.activeElement
      return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    }

    function update() {
      if (!isTextEditing()) {
        baseHeight = Math.max(baseHeight, window.innerHeight)
        document.documentElement.style.setProperty('--keyboard-offset', '0px')
        document.body.classList.remove('keyboard-open')
        return
      }

      const vp = window.visualViewport!
      const keyboardOffset = Math.max(0, baseHeight - vp.height - vp.offsetTop)
      document.documentElement.style.setProperty('--keyboard-offset', `${keyboardOffset}px`)
      document.body.classList.toggle('keyboard-open', keyboardOffset > 80)
    }

    const vp = window.visualViewport
    vp.addEventListener('resize', update)
    vp.addEventListener('scroll', update)
    window.addEventListener('focusin', update)
    window.addEventListener('focusout', update)

    return () => {
      vp.removeEventListener('resize', update)
      vp.removeEventListener('scroll', update)
      window.removeEventListener('focusin', update)
      window.removeEventListener('focusout', update)
      document.documentElement.style.setProperty('--keyboard-offset', '0px')
      document.body.classList.remove('keyboard-open')
    }
  }, [])
}
