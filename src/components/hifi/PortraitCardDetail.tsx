import type { PortraitCardSection } from '@/types/portrait-card'

type Props = {
  summary?: string
  lead?: string
  sections?: PortraitCardSection[]
  anchoredFacts?: string[]
}

export function PortraitCardDetail({ summary, lead, sections = [], anchoredFacts = [] }: Props) {
  const displayLead = lead && lead !== summary ? lead : undefined

  return (
    <div className="portrait-detail-card profile-block">
      <p className="authority-badge">清北学霸 · 家庭智慧</p>
      {displayLead ? <p className="portrait-detail-lead">{displayLead}</p> : null}
      {sections.map((section) => (
        <div key={section.heading} className="portrait-detail-section">
          <h4 className="portrait-detail-heading">{section.heading}</h4>
          <ul className="portrait-detail-list">
            {section.items.map((item) => (
              <li key={item.slice(0, 32)}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {anchoredFacts.length > 0 ? (
        <div className="profile-fact-quotes portrait-detail-facts">
          <h3>依据你家已记录的事实</h3>
          <ul>
            {anchoredFacts.map((f) => (
              <li key={f.slice(0, 32)}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!displayLead && !sections.length && summary ? (
        <p className="portrait-detail-lead">{summary}</p>
      ) : null}
    </div>
  )
}
