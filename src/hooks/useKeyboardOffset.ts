'use client'

import { useEffect } from 'react'

/**
 * iOS/Android 软键盘：把 input-dock 钉在 visualViewport 底边（键盘顶），
 * 并锁住 body 滚动，避免 Safari 把整页顶上去留空隙。
 */
export function useKeyboardOffset() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const vv = window.visualViewport
    let scrollY = 0

    function isTextEditing() {
      const active = document.activeElement
      return !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    }

    function clear() {
      document.documentElement.style.setProperty('--keyboard-offset', '0px')
      document.body.classList.remove('keyboard-open')
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (scrollY) window.scrollTo(0, scrollY)
      scrollY = 0
    }

    function update() {
      if (!isTextEditing()) {
        clear()
        return
      }

      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      const keyboardOpen = offset > 50

      document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`)
      document.body.classList.toggle('keyboard-open', keyboardOpen)

      if (keyboardOpen) {
        if (document.body.style.position !== 'fixed') {
          scrollY = window.scrollY
          document.body.style.position = 'fixed'
          document.body.style.top = `-${scrollY}px`
          document.body.style.width = '100%'
        }
      }
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('focusin', update)
    window.addEventListener('focusout', () => {
      // iOS 键盘收起有延迟，避免过早 clear
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
