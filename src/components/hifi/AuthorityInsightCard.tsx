import type { ReactNode } from 'react'

type Props = {
  title?: string
  body: string
  children?: ReactNode
}

/** 分析类内容的权威感卡片（清北学霸家庭智慧背书） */
export function AuthorityInsightCard({ title = '育见解读', body, children }: Props) {
  return (
    <div className="authority-insight-card profile-block">
      <p className="authority-badge">清北学霸 · 家庭智慧</p>
      {title ? <h3 className="authority-insight-title">{title}</h3> : null}
      {body.split('\n').filter(Boolean).map((para) => (
        <p key={para.slice(0, 20)} className="authority-insight-body">{para}</p>
      ))}
      {children}
    </div>
  )
}
