'use client'

import type { StructuralTension } from '@/types/deep-model-digest'

type Props = {
  tensions: StructuralTension[]
  title?: string
  compact?: boolean
}

export function StructuralTensionCard({
  tensions,
  title = '家庭结构里值得先看的张力',
  compact = false,
}: Props) {
  if (!tensions.length) return null

  return (
    <div
      className="soft-card"
      style={{
        background: 'rgba(157,204,117,0.10)',
        border: '1px solid rgba(111,159,86,0.16)',
        marginTop: compact ? 0 : undefined,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6f9f56', marginBottom: 8 }}>
        {title}
        {tensions.length > 1 ? `（${tensions.length} 个）` : ''}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tensions.map((t) => (
          <div
            key={`${t.title}-${t.detail}`}
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: 12,
              border: '1px solid rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 4 }}>{t.title}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: '#6E6E73' }}>{t.detail}</div>
            {t.confidence === 'low' ? (
              <p className="hint-text" style={{ marginTop: 6, marginBottom: 0 }}>
                仍在观察中，后续交流会继续修正。
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
