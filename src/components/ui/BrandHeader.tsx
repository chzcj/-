export function BrandHeader({
  title = '育见',
  badge = '懂你家孩子',
  avatarSrc,
}: {
  title?: string
  badge?: string
  avatarSrc?: string
}) {
  return (
    <header className="flex items-center gap-3" style={{ marginBottom: 16 }}>
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 40,
          height: 40,
          borderRadius: 16,
          background: 'linear-gradient(140deg, #8ab86a 0%, var(--brand) 55%, #5a8f42 100%)',
          color: '#fff',
          fontSize: 17,
          fontWeight: 700,
        }}
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="" style={{ width: 40, height: 40, borderRadius: 16, objectFit: 'cover' }} />
        ) : (
          '镜'
        )}
      </div>
      <div>
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
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 22,
            padding: '0 8px',
            borderRadius: 999,
            background: 'rgba(111, 159, 86, 0.12)',
            color: 'var(--green-deep)',
            fontSize: 11,
            lineHeight: '16px',
            fontWeight: 500,
            marginTop: 2,
          }}
        >
          {badge}
        </span>
      </div>
    </header>
  )
}
