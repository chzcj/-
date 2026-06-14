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
    <header
      className="flex items-center gap-3"
      style={{ minHeight: 48, marginBottom: 16 }}
    >
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.64)',
            border: '1px solid rgba(29, 29, 31, 0.08)',
            color: '#6E6E73',
          }}
        >
          <ChevronLeft size={20} />
        </button>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: '#1D1D1F',
            lineHeight: '22px',
          }}
        >
          {title}
        </div>
        {badge ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 20,
              padding: '0 7px',
              borderRadius: 999,
              background: 'rgba(110, 106, 248, 0.08)',
              color: '#6E6AF8',
              fontSize: 11,
              lineHeight: '16px',
              fontWeight: 500,
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {rightSlot}
    </header>
  )
}
