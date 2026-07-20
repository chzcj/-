'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ProfileSubPage } from '../../_components/ProfileSubPage'
import type { MemoryMomentDetail } from '@/types/handbook-pack'

export default function MemoryDetailPage() {
  const params = useParams()
  const memoryId = decodeURIComponent(String(params.id || ''))
  const [detail, setDetail] = useState<MemoryMomentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!memoryId) return
    void (async () => {
      setLoading(true)
      const res = await fetch(`/api/profile/memory/${encodeURIComponent(memoryId)}`, {
        credentials: 'include',
      }).then((r) => r.json())
      if (res.ok && res.data?.found !== false && res.data?.title) {
        setDetail(res.data as MemoryMomentDetail)
        setNotFound(false)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    })()
  }, [memoryId])

  return (
    <ProfileSubPage title="记忆详情">
      {loading ? <p className="hint-text">正在整理…</p> : null}
      {notFound ? <p className="hint-text">这条记忆暂时找不到。</p> : null}
      {detail ? (
        <>
          <p style={{ fontSize: 12, color: '#6f9f56' }}>{detail.kicker}</p>
          <h3>{detail.title}</h3>
          {detail.lead ? <p style={{ color: '#6f9f56', fontWeight: 600 }}>{detail.lead}</p> : null}
          {detail.whyIncluded ? (
            <section className="profile-block" style={{ marginTop: 16 }}>
              <h4>01 · 为什么进手账</h4>
              <p className="hint-text">{detail.whyIncluded}</p>
            </section>
          ) : null}
          {detail.evidenceBody ? (
            <section className="profile-block" style={{ marginTop: 16 }}>
              <h4>02 · 原文摘录</h4>
              <p className="hint-text" style={{ whiteSpace: 'pre-wrap' }}>
                {detail.evidenceBody}
              </p>
            </section>
          ) : detail.whyIncluded ? (
            <section className="profile-block" style={{ marginTop: 16 }}>
              <h4>02 · 原文摘录</h4>
              <p className="hint-text">
                本条缺少可溯源原话，暂不展示「原文摘录」。若只是标签或摘要，不会当作家长当时说的话。
              </p>
            </section>
          ) : null}
          {detail.keyQuotes?.length ? (
            <section className="profile-block" style={{ marginTop: 16 }}>
              <h4>{detail.evidenceBody || detail.whyIncluded ? '03 · 提炼关键句' : '02 · 提炼关键句'}</h4>
              <ul>
                {detail.keyQuotes.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {detail.interpretation ? (
            <section className="profile-block" style={{ marginTop: 16 }}>
              <h4>AI 轻解读</h4>
              <p className="hint-text">{detail.interpretation}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </ProfileSubPage>
  )
}
