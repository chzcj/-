'use client'

import type { ReactNode } from 'react'
import type { DailySection } from '@/types/daily-message'
import { DailySectionList } from '@/components/daily/DailySectionView'
import { DailyThinkingPanel } from '@/components/daily/DailyThinkingPanel'
import type { DailyThinkingChip } from '@/types/daily-message'

type DailyBubbleShellProps = {
  prose?: string
  sections?: DailySection[]
  actions?: ReactNode
  streaming?: boolean
  proseComplete?: boolean
  sectionErrors?: Set<string>
  onRetrySection?: (sectionId: string) => void
  interrupted?: boolean
  thinkingChips?: DailyThinkingChip[]
  showThinking?: boolean
  revealedIds?: Set<string>
  expandedIds?: Set<string>
  animateSections?: boolean
  animatingId?: string | null
  className?: string
}

/** 与 /daily 单气泡结构一致，供交流页与深度展开页复用 */
export function DailyBubbleShell({
  prose = '',
  sections = [],
  actions,
  streaming = false,
  proseComplete = true,
  sectionErrors,
  onRetrySection,
  interrupted,
  thinkingChips,
  showThinking = false,
  revealedIds,
  expandedIds,
  animateSections = false,
  animatingId = null,
  className = '',
}: DailyBubbleShellProps) {
  const showProse = Boolean(prose.trim())
  const showSectionArea = proseComplete && sections.length > 0
  const allRevealed = revealedIds ?? new Set(sections.map((s) => s.id))
  const allExpanded = expandedIds ?? allRevealed

  return (
    <div className={`message-row ai${className ? ` ${className}` : ''}`}>
      <div className={`bubble${streaming || showThinking ? ' thinking-bubble' : ''}`}>
        {showThinking && thinkingChips?.length ? <DailyThinkingPanel chips={thinkingChips} /> : null}

        {showThinking && !thinkingChips?.length ? (
          <span className="thinking">
            正在结合孩子信息…
            <span className="thinking-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </span>
        ) : null}

        {streaming && !showThinking && !prose ? (
          <span className="thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        ) : null}

        {showProse ? <div className="bubble-reply">{prose}</div> : null}

        {interrupted ? <p className="section-footnote turn-interrupted-note">已打断，以上为已输出内容。</p> : null}

        {showSectionArea ? (
          <DailySectionList
            sections={sections}
            revealedIds={allRevealed}
            expandedIds={allExpanded}
            animateNew={animateSections}
            animatingId={animatingId}
            sectionErrors={sectionErrors}
            onRetrySection={onRetrySection}
          />
        ) : null}

        {actions}
      </div>
    </div>
  )
}
