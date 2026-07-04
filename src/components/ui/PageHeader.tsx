import { ChevronLeft } from 'lucide-react'

export function PageHeader({
  title,
  badge,
  showBack,
  onBack,
  rightSlot,
}: {
  title: string
  badge?: string
  showBack?: boolean
  onBack?: () => void
  rightSlot?: React.ReactNode
}) {
  return (
    <header className="flex items-center gap-3" style={{ minHeight: 48, marginBottom: 16 }}>
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.64)',
            border: '1px solid rgba(29, 29, 31, 0.08)',
            color: 'var(--text-secondary)',
          }}
        >
          <ChevronLeft size={20} />
        </button>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: '#1D1D1F', lineHeight: '22px' }}>{title}</div>
        {badge ? <span className="page-header-badge">{badge}</span> : null}
      </div>
      {rightSlot}
    </header>
  )
}
