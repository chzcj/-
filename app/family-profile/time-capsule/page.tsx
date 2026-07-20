'use client'

import { useEffect, useState } from 'react'
import { ProfileSubPage } from '../_components/ProfileSubPage'
import type { HandbookPack, TimeCapsuleSnapshot } from '@/types/handbook-pack'

export default function TimeCapsulePage() {
  const [snap, setSnap] = useState<TimeCapsuleSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const res = await fetch('/api/profile/handbook-pack', { credentials: 'include' }).then((r) => r.json())
      if (res.ok) setSnap((res.data as HandbookPack).timeCapsuleSnapshot)
      setLoading(false)
    })()
  }, [])

  return (
    <ProfileSubPage title="对比上次">
      {loading ? <p className="hint-text">正在整理…</p> : null}
      {!loading && !snap ? (
        <p className="hint-text">还没有足够的记忆来做对比。继续记录后，这里会出现「那时 vs 现在」的回看。</p>
      ) : null}
      {snap ? (
        <>
          <div style={{ display: 'grid', gap: 16, marginTop: 12 }}>
            <article className="profile-block">
              <h4>{snap.thenLabel}</h4>
              <p className="hint-text">{snap.thenSnapshot}</p>
              {snap.thenQuote ? <p style={{ marginTop: 8, fontStyle: 'italic' }}>「{snap.thenQuote}」</p> : null}
            </article>
            <article className="profile-block">
              <h4>{snap.nowLabel}</h4>
              <p className="hint-text">{snap.nowSnapshot}</p>
              {snap.relationShift ? <p style={{ marginTop: 8, color: '#6f9f56' }}>{snap.relationShift}</p> : null}
            </article>
          </div>
        </>
      ) : null}
    </ProfileSubPage>
  )
}
