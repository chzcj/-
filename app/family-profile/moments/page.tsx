'use client'

import { useEffect, useState } from 'react'
import { ProfileSubPage } from '../_components/ProfileSubPage'
import type { HighlightMoment } from '@/types/highlight-moment'
import type { HandbookPack } from '@/types/handbook-pack'

export default function MomentsPage() {
  const [moments, setMoments] = useState<HighlightMoment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const res = await fetch('/api/profile/handbook-pack', { credentials: 'include' }).then((r) => r.json())
      if (res.ok) setMoments((res.data as HandbookPack).highlightMoments || [])
      setLoading(false)
    })()
  }, [])

  return (
    <ProfileSubPage title="闪光时刻">
      {loading ? <p className="hint-text">正在整理…</p> : null}
      {!loading && !moments.length ? (
        <p className="hint-text">还没有标出的闪光时刻。继续交流后，亮点会在这里汇总。</p>
      ) : null}
      {moments.map((m, i) => (
        <article key={`${m.title}-${i}`} style={{ padding: '14px 0', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{m.title}</h3>
          <p className="hint-text" style={{ margin: 0 }}>{m.teaser}</p>
          {m.whyHighlighted ? (
            <p style={{ fontSize: 12, color: '#6f9f56', marginTop: 6 }}>{m.whyHighlighted}</p>
          ) : null}
        </article>
      ))}
    </ProfileSubPage>
  )
}
