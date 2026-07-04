'use client'

type ChildReaction = { immediateReaction: string; innerReaction: string; behaviorRisk: string }

export type RehearsalAnalyzeData = {
  profileAware?: boolean
  childLikelyHearing?: string
  possibleChildReaction?: ChildReaction
  riskPoints?: string[]
  likelyTriggeredMechanisms?: string[]
  saferVersion?: string
  whyThisIsSafer?: string
  avoidPhrases?: string[]
  headline?: string
  explanation?: string
  childMayHear?: string[] | string
  stuckPoint?: string
  suggestedWording?: string
  taskTitle?: string
  closingAdvice?: string
  showSuggestedWording?: boolean
  dailyToneDetected?: boolean
  suggestedWordingHint?: string
  dailyToneReminder?: string
}

function ProfileBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="profile-block">
      <h3>{title}</h3>
      {typeof children === 'string' ? <p style={{ whiteSpace: 'pre-wrap' }}>{children}</p> : children}
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="profile-block">
      <h3>{title}</h3>
      <ul>
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

export function RehearsalOutput({ data }: { data: RehearsalAnalyzeData }) {
  if (data.profileAware) {
    return (
      <section className="section">
        <h2 className="section-title">预演分析</h2>
        {data.childLikelyHearing ? <ProfileBlock title="孩子可能先听成">{data.childLikelyHearing}</ProfileBlock> : null}
        {data.possibleChildReaction ? (
          <ProfileBlock title="他可能的反应">
            {`当下：${data.possibleChildReaction.immediateReaction}\n心里：${data.possibleChildReaction.innerReaction}\n行为风险：${data.possibleChildReaction.behaviorRisk}`}
          </ProfileBlock>
        ) : null}
        <ListBlock title="可能触发的机制" items={data.likelyTriggeredMechanisms || []} />
        <ListBlock title="容易踩的点" items={data.riskPoints || []} />
        {data.saferVersion ? (
          <div className="profile-block">
            <h3>更建议这样开口</h3>
            <p>{data.saferVersion}</p>
            {data.whyThisIsSafer ? <p className="hint-text">{data.whyThisIsSafer}</p> : null}
          </div>
        ) : null}
        {data.avoidPhrases?.length ? (
          <div className="layer-tags">
            {data.avoidPhrases.map((p) => (
              <span key={p} className="tag">
                避免：{p}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <section className="section">
      <h2 className="section-title">预演分析</h2>
      {data.headline ? (
        <div className="profile-block">
          <h3>{data.headline}</h3>
          {data.explanation ? <p>{data.explanation}</p> : null}
        </div>
      ) : null}
      {Array.isArray(data.childMayHear) && data.childMayHear.length ? (
        <div className="simulation-feed">
          {data.childMayHear.map((h, i) => (
            <div key={i} className="message-row ai">
              <div className="bubble">{h}</div>
            </div>
          ))}
        </div>
      ) : typeof data.childMayHear === 'string' && data.childMayHear ? (
        <ProfileBlock title="孩子可能先听成">{data.childMayHear}</ProfileBlock>
      ) : null}
      {data.stuckPoint ? <ProfileBlock title="更容易卡住的地方">{data.stuckPoint}</ProfileBlock> : null}
      {data.suggestedWording ? (
        <div className="profile-block">
          <h3>更建议这样开口</h3>
          <p>{data.suggestedWording}</p>
        </div>
      ) : null}
    </section>
  )
}
