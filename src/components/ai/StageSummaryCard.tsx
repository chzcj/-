export function StageSummaryCard({
  mainJudgment,
  facts,
  note,
  pendingHypotheses = [],
}: {
  mainJudgment: string
  facts: string[]
  note?: string
  pendingHypotheses?: string[]
}) {
  return (
    <div
      className="card"
      style={{
        padding: 22,
        borderRadius: 28,
        background: 'rgba(255, 255, 255, 0.72)',
        border: '1px solid rgba(29, 29, 31, 0.06)',
        margin: '16px 0',
      }}
    >
      <div className="ui-accent-label" style={{ marginBottom: 10 }}>当前判断</div>
      <div style={{ fontSize: 16, lineHeight: 1.62, color: '#1D1D1F', marginBottom: 20, whiteSpace: 'pre-wrap' }}>
        {mainJudgment}
      </div>

      {facts.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>已提取事实</div>
          {facts.map((fact, i) => (
            <div
              key={i}
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
                padding: '6px 0',
                borderTop: i > 0 ? '1px solid rgba(29, 29, 31, 0.04)' : 'none',
              }}
            >
              {fact}
            </div>
          ))}
        </div>
      ) : null}

      {pendingHypotheses.length > 0 ? (
        <div style={{ marginBottom: note ? 16 : 0 }}>
          <div className="ui-accent-label">还在验证的方向</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pendingHypotheses.map((h) => (
              <span key={h} className="ui-accent-chip" style={{ borderRadius: 999, fontSize: 12 }}>
                {h}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {note ? (
        <div className="ui-soft-panel" style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-tertiary)' }}>{note}</div>
      ) : null}
    </div>
  )
}
