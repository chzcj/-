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
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>
          追问目的
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.55, color: '#1D1D1F' }}>
          {purpose}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>
          潜在方向
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {directions.map((d) => (
            <span
              key={d}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(110, 106, 248, 0.06)',
                color: '#6E6AF8',
                fontSize: 13,
                fontWeight: 500,
                border: '1px solid rgba(110, 106, 248, 0.12)',
              }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>
          语音提示
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.55, color: '#6E6E73' }}>
          {voicePrompt}
        </div>
      </div>
    </div>
  )
}
