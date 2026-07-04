'use client'

import { ArrowLeft } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'

export type HiFiAction = {
  id?: string
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'quiet'
  disabled?: boolean
  icon?: ReactNode
}

type HiFiBuildShellProps = {
  topTitle: string
  stepLabel: string
  progress: number
  children: ReactNode
  actions?: HiFiAction[]
  onBack?: () => void
  animate?: boolean
}

/** 对齐 design-reference/hifi-build.css：top-bar 隐藏，标题在 hero-card 内 */
export function HiFiBuildShell({
  topTitle,
  stepLabel,
  progress,
  children,
  actions = [],
  onBack,
  animate = true,
}: HiFiBuildShellProps) {
  const pageId = useId()

  useEffect(() => {
    if (!animate) return
    const el = document.getElementById(pageId)
    if (!el) return
    el.classList.remove('page-entering')
    void el.offsetWidth
    el.classList.add('page-entering')
  }, [pageId, topTitle, animate])

  return (
    <div className="hifi-build-root">
      <main className="app-shell" aria-label={topTitle}>
        <div className="app-safe-top" aria-hidden="true" />

        <header className="top-bar" aria-hidden="true">
          <div className="title-stack">
            <h1 className="top-title">{topTitle}</h1>
            <div className="top-meta hidden">
              <div className="top-state">{stepLabel}</div>
            </div>
          </div>
        </header>

        <section className="progress-wrap" aria-label="采集进度">
          <div className="progress-track">
            <span className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        </section>

        <section className="page" id={pageId}>
          {onBack ? (
            <button type="button" className="hifi-page-back" onClick={onBack} aria-label="返回">
              <ArrowLeft size={20} />
            </button>
          ) : null}
          {children}
        </section>

        {actions.length > 0 ? (
          <footer className={`bottom-actions hifi-bottom-actions${actions.length > 2 ? ' dense' : ''}`}>
            {actions.map((action, index) => (
              <button
                key={action.id || `${action.variant || 'primary'}-${index}`}
                type="button"
                className={
                  action.variant === 'secondary'
                    ? 'secondary-button'
                    : action.variant === 'quiet'
                      ? 'quiet-button'
                      : 'primary-button'
                }
                disabled={action.disabled}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (action.disabled) return
                  action.onClick()
                }}
              >
                {action.icon ? <span className="button-icon">{action.icon}</span> : null}
                {action.label}
              </button>
            ))}
          </footer>
        ) : null}
      </main>
    </div>
  )
}
