'use client'

import { useEffect, useState } from 'react'
import { ProfileSubPage } from '../_components/ProfileSubPage'
import type { HandbookPack, WeeklyHandbook } from '@/types/handbook-pack'

export default function HandbookPage() {
  const [handbook, setHandbook] = useState<WeeklyHandbook | null>(null)
  const [heroCopy, setHeroCopy] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const res = await fetch('/api/profile/handbook-pack', { credentials: 'include' }).then((r) => r.json())
      if (res.ok) {
        const pack = res.data as HandbookPack
        setHandbook(pack.handbook)
        setHeroCopy(pack.hero.heroCopy)
      }
      setLoading(false)
    })()
  }, [])

  return (
    <ProfileSubPage title="近7天手账">
      {loading ? <p className="hint-text">正在整理…</p> : null}
      {!loading ? (
        <>
          <p style={{ fontSize: 12, color: '#6f9f56' }}>{handbook?.weekRangeLabel || '近7天'}</p>
          <h3 style={{ fontSize: 22, margin: '6px 0 10px' }}>{handbook?.headline || '近7天还在积累记忆'}</h3>
          <p className="hint-text">{handbook?.coverBlurb || heroCopy}</p>
          <section style={{ marginTop: 18 }}>
            <h4>阶段性亮点</h4>
            <p className="hint-text">{handbook?.highlight || '继续记录后，亮点会出现在这里。'}</p>
          </section>
          <section style={{ marginTop: 18 }}>
            <h4>关系瞬间</h4>
            <p className="hint-text">{handbook?.relationMoment || '语音与随笔里的关系瞬间会在这里汇总。'}</p>
          </section>
          <section style={{ marginTop: 18 }}>
            <h4>对比上次</h4>
            <p className="hint-text">{handbook?.compareLastWeek || '积累足够记忆后，可与上一阶段对比回看。'}</p>
          </section>
        </>
      ) : null}
    </ProfileSubPage>
  )
}
