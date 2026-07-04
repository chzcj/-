export function FollowUpCard({
  purpose,
  directions,
  voicePrompt,
}: {
  purpose: string
  directions: string[]
  voicePrompt: string
}) {
  return (
    <section className="section">
      <div className="summary-card">
        <h3>追问目的</h3>
        <p className="summary-lead">{purpose}</p>

        {directions.length > 0 ? (
          <>
            <p className="section-title" style={{ marginTop: 14 }}>
              可以从这些方向补
            </p>
            <div className="summary-hypotheses">
              {directions.map((d) => (
                <span key={d} className="chip">
                  {d}
                </span>
              ))}
            </div>
          </>
        ) : null}

        <p className="section-title" style={{ marginTop: 14 }}>
          可以这样补充
        </p>
        <p className="summary-note">{voicePrompt}</p>
      </div>
    </section>
  )
}
