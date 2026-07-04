'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { loadDailyThread } from '@/lib/daily/dailyStreamClient'

type Opening = { wording: string; reason: string }
type GuideSection = { title: string; body: string }

type GuideData = {
  intro?: string
  openings: Opening[]
  sections?: GuideSection[]
}

function HowToSpeakContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const traceId = searchParams.get('traceId')?.trim() || ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guide, setGuide] = useState<GuideData | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setError(null)

      let parentText = ''
      let assistantReply = ''
      if (traceId) {
        const turns = loadDailyThread()
        for (let i = turns.length - 1; i >= 0; i -= 1) {
          const turn = turns[i]
          if (turn.role === 'ai' && turn.traceId === traceId) {
            assistantReply = turn.text || ''
            const prev = turns[i - 1]
            if (prev?.role === 'parent') parentText = prev.text || ''
            break
          }
        }
      }

      try {
        const res = await fetch('/api/daily/how-to-speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ traceId, parentText, assistantReply }),
        })
        const json = await res.json()
        if (cancelled) return

        if (json.ok && json.data) {
          setGuide(json.data as GuideData)
        } else {
          setError(json.error?.message || '指南暂时没有生成出来')
        }
      } catch {
        if (!cancelled) setError('网络不太稳定，请稍后再试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [traceId])

  return (
    <HiFiMainShell activeTab="chat">
      <section className="section how-to-speak-page">
        <div className="how-to-speak-header">
          <button type="button" className="secondary-button compact-button" onClick={() => router.push('/daily')}>
            返回交流
          </button>
          <h2 className="section-title">我现在怎么开口</h2>
        </div>

        {loading ? (
          <div className="message-row ai">
            <div className="bubble thinking-bubble">
              <span className="thinking-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        ) : null}

        {!loading && error ? <p className="hint-text">{error}</p> : null}

        {!loading && guide ? (
          <>
            {guide.intro ? <p className="hero-copy">{guide.intro}</p> : null}

            {guide.sections?.map((section) => (
              <div key={section.title} className="profile-block">
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </div>
            ))}

            <div className="how-to-speak-list">
              {guide.openings.map((item, index) => (
                <div key={`${item.wording.slice(0, 12)}-${index}`} className="hint-block">
                  <p className="hint-block-title">说法 {index + 1}</p>
                  <p className="hint-block-text">{item.wording}</p>
                  <p className="how-to-speak-reason">为什么：{item.reason}</p>
                </div>
              ))}
            </div>

            <button type="button" className="primary-button wide-button" onClick={() => router.push('/daily')}>
              回到交流继续聊
            </button>
          </>
        ) : null}
      </section>
    </HiFiMainShell>
  )
}

export default function HowToSpeakPage() {
  return (
    <OnboardingGuard>
      <Suspense
        fallback={
          <HiFiMainShell activeTab="chat">
            <section className="section">
              <p className="hint-text">加载中…</p>
            </section>
          </HiFiMainShell>
        }
      >
        <HowToSpeakContent />
      </Suspense>
    </OnboardingGuard>
  )
}
