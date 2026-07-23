'use client'

import type { DailySection } from '@/types/daily-message'
import { AuthorityInsightCard } from '@/components/hifi/AuthorityInsightCard'
import { parseStreamingSectionBody } from '@/lib/daily/parseStreamingSection'

const AUTHORITY_SECTION_IDS = new Set(['diagnosis_headline', 'this_time'])

function sectionPlainBody(section: DailySection): string {
  if (section.streamingText) return section.streamingText
  const parts = [
    ...(section.paragraphs || []),
    ...(section.items || []),
    ...(section.quotes || []),
    section.note || '',
  ].filter(Boolean)
  return parts.join('\n')
}

function SectionBody({ section }: { section: DailySection }) {
  if (AUTHORITY_SECTION_IDS.has(section.id) && !section.streamingText) {
    const body = sectionPlainBody(section)
    if (body.trim()) {
      return (
        <AuthorityInsightCard title={section.label} body={body} />
      )
    }
  }

  if (section.streamingText !== undefined && section.streamingText !== '') {
    // 流式期间按 kind 增量解析段落/列表/引语，避免「一口气出完再换行」。
    const parsed = parseStreamingSectionBody(section.streamingText, section.kind)
    const hasStructured = parsed.paragraphs || parsed.items || parsed.quotes
    if (hasStructured) {
      return (
        <div className="section-body section-body-streaming">
          {parsed.paragraphs?.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {parsed.items?.length ? (
            <ul className="bubble-list">
              {parsed.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {parsed.quotes?.length ? (
            <div className="quote-list">
              {parsed.quotes.map((q) => (
                <p key={q} className="quote-line">
                  {q}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      )
    }
    return (
      <div className="section-body section-body-streaming">
        <p>{section.streamingText}</p>
      </div>
    )
  }

  return (
    <div className="section-body">
      {section.paragraphs?.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {section.items?.length ? (
        <ul className="bubble-list">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.quotes?.length ? (
        <div className="quote-list">
          {section.quotes.map((q) => (
            <p key={q} className="quote-line">
              {q}
            </p>
          ))}
        </div>
      ) : null}
      {section.note ? <p className="section-footnote">{section.note}</p> : null}
    </div>
  )
}

export function DailySectionView({
  section,
  visible,
  animate,
  hasError,
  onRetry,
}: {
  section: DailySection
  visible: boolean
  animate?: boolean
  hasError?: boolean
  onRetry?: () => void
}) {
  if (!visible) return null

  return (
    <div
      className={`bubble-section${animate ? ' section-reveal' : ''}`}
      data-section-id={section.id}
    >
      <span className="section-label">{section.label}</span>
      {hasError ? (
        <div className="section-error-block">
          <p className="section-error-text">这部分未生成</p>
          {onRetry ? (
            <button type="button" className="pill section-retry-btn" onClick={onRetry}>
              重试
            </button>
          ) : null}
        </div>
      ) : (
        <SectionBody section={section} />
      )}
    </div>
  )
}

export function DailySectionList({
  sections,
  revealedIds,
  expandedIds,
  animateNew,
  animatingId,
  sectionErrors,
  onRetrySection,
}: {
  sections: DailySection[]
  revealedIds: Set<string>
  expandedIds: Set<string>
  animateNew?: boolean
  animatingId?: string | null
  sectionErrors?: Set<string>
  onRetrySection?: (sectionId: string) => void
}) {
  return (
    <>
      {sections.map((section) => {
        const isHidden = section.hidden && !expandedIds.has(section.id)
        if (isHidden) return null
        if (!revealedIds.has(section.id) && !sectionErrors?.has(section.id)) return null
        return (
          <DailySectionView
            key={section.id}
            section={section}
            visible
            animate={animateNew && section.id === animatingId}
            hasError={sectionErrors?.has(section.id)}
            onRetry={onRetrySection ? () => onRetrySection(section.id) : undefined}
          />
        )
      })}
    </>
  )
}
