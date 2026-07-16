'use client'

import { useEffect, useState } from 'react'
import type { DailySection } from '@/types/daily-message'
import { DailySectionList } from '@/components/daily/DailySectionView'
import { VoiceOverlay } from '@/components/voice/VoiceOverlay'

function sectionHasBody(section: DailySection): boolean {
  if (section.streamingText?.trim()) return true
  if (section.paragraphs?.some((p) => p.trim())) return true
  if (section.items?.some((p) => p.trim())) return true
  if (section.quotes?.some((p) => p.trim())) return true
  if (section.note?.trim()) return true
  return false
}

type DailyDeepExpandCardProps = {
  sections: DailySection[]
  prose?: string
  traceId?: string
  onClose?: () => void
}

export function DailyDeepExpandCard({ sections, traceId, onClose }: DailyDeepExpandCardProps) {
  const [feedback, setFeedback] = useState<'accurate' | 'partial' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [partialOverlayOpen, setPartialOverlayOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const readySections = sections.filter(sectionHasBody)
  const preparing = readySections.length === 0

  useEffect(() => {
    if (!traceId) return
    const firedKey = `childos_deep_expand_fired_${traceId}`
    if (sessionStorage.getItem(firedKey)) return
    sessionStorage.setItem(firedKey, '1')
    void fetch('/api/daily/deep-expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traceId }),
    }).catch(() => {
      /* 沉淀失败不影响阅读 */
    })
  }, [traceId])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  async function postFeedback(kind: 'accurate' | 'partial', note?: string) {
    const sectionIds = readySections.map((s) => s.id)
    if (!traceId) {
      setToast('已记录在本机；回到交流再生成一轮后可同步到服务器。')
      return false
    }

    try {
      const res = await fetch('/api/daily/section-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId, kind, sectionIds, note: note?.trim() || undefined }),
      })
      const json = (await res.json()) as { ok?: boolean }
      const saved = Boolean(json.ok)
      setToast(
        saved
          ? kind === 'accurate'
            ? '收到了，我会更按这个方向理解。'
            : note?.trim()
              ? '收到了，这条校正会进入记忆。'
              : '收到了，已记下不太像。'
          : '反馈已记下；若未同步成功，可再试一次。'
      )
      return saved
    } catch {
      setToast('反馈已记下；若未同步成功，可再试一次。')
      return false
    }
  }

  const revealed = new Set(readySections.map((s) => s.id))

  return (
    <div className="deep-expand-card">
      <div className="deep-expand-card-header">
        <button type="button" className="deep-expand-toggle" onClick={() => setCollapsed((v) => !v)}>
          <span className="section-label">深度展开</span>
          <span className="deep-expand-chevron" aria-hidden="true">
            {collapsed ? '▸' : '▾'}
          </span>
        </button>
        {onClose ? (
          <button type="button" className="deep-expand-close" onClick={onClose} aria-label="收起">
            ×
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <>
          <div className="deep-expand-body">
            {preparing ? (
              <p className="deep-expand-preparing">整理中…</p>
            ) : (
              <DailySectionList
                sections={readySections}
                revealedIds={revealed}
                expandedIds={revealed}
                animateNew={false}
              />
            )}
          </div>

          {!preparing ? (
            <div className="suggestion-strip deep-expand-feedback">
              <button
                type="button"
                className={`pill${feedback === 'accurate' ? ' primary' : ''}`}
                disabled={submitting || feedback !== null}
                onClick={() => {
                  if (submitting || feedback) return
                  setSubmitting(true)
                  setFeedback('accurate')
                  void postFeedback('accurate').finally(() => setSubmitting(false))
                }}
              >
                这段像我家情况
              </button>
              <button
                type="button"
                className={`pill${feedback === 'partial' ? ' primary' : ''}`}
                disabled={submitting || feedback !== null}
                onClick={() => {
                  if (submitting || feedback) return
                  setPartialOverlayOpen(true)
                }}
              >
                哪里不太像
              </button>
            </div>
          ) : null}
          {toast ? <div className="toast deep-expand-toast">{toast}</div> : null}
        </>
      ) : null}

      <VoiceOverlay
        open={partialOverlayOpen}
        title="说说哪里不太像"
        description="可以补充一句哪里不准；也可以直接点「先记不太像」。"
        allowEmpty
        emptyFinishLabel="先记不太像"
        finishLabel="提交校正"
        loading={submitting}
        onCancel={() => !submitting && setPartialOverlayOpen(false)}
        onFinish={(text) => {
          if (submitting) return
          setSubmitting(true)
          setPartialOverlayOpen(false)
          setFeedback('partial')
          void postFeedback('partial', text).finally(() => setSubmitting(false))
        }}
      />
    </div>
  )
}
