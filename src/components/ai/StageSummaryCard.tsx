export function StageSummaryCard({
  mainJudgment,
  facts,
  note,
}: {
  mainJudgment: string
  facts: string[]
  note?: string
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
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 10 }}>
        当前判断
      </div>
      <div style={{ fontSize: 16, lineHeight: 1.62, color: '#1D1D1F', marginBottom: 20, whiteSpace: 'pre-wrap' }}>
        {mainJudgment}
      </div>

      {facts.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6E73', marginBottom: 8 }}>
            已提取事实
          </div>
          {facts.map((fact, i) => (
            <div
              key={i}
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: '#6E6E73',
                padding: '6px 0',
                borderTop: i > 0 ? '1px solid rgba(29, 29, 31, 0.04)' : 'none',
              }}
            >
              {fact}
            </div>
          ))}
        </div>
      ) : null}

      {note ? (
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: '#A1A1A6',
            padding: '12px 14px',
            borderRadius: 16,
            background: 'rgba(110, 106, 248, 0.04)',
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  )
}
