'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { DialogueAnalysisV2View } from '@/components/rehearsal/DialogueAnalysisV2View'
import type { DialogueAnalysisPayload, DialogueAnalysisV2 } from '@yujian/contracts/rehearsal-dialogue'
import { writeLastDialogueAnalysisId } from '@/lib/rehearsal-scenes-cache'

function DialogueResultInner() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') || ''
  const [data, setData] = useState<DialogueAnalysisPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id.startsWith('da_')) {
      setError('无效的分析链接')
      setLoading(false)
      return
    }
    void (async () => {
      try {
        const res = await fetch(`/api/rehearsal/dialogue-analyze?id=${encodeURIComponent(id)}`, {
          credentials: 'include',
        })
        const json = await res.json()
        if (!json.ok) {
          setError(json.error?.message || '加载失败')
          return
        }
        setData(json.data as DialogueAnalysisPayload)
        writeLastDialogueAnalysisId(id)
      } catch {
        setError('网络有点忙，可以稍后再试。')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const goRehearsal = () => {
    if (data?.rehearsalSeed) {
      try {
        sessionStorage.setItem('childos_rehearsal_dialogue_context', JSON.stringify(data.rehearsalSeed))
      } catch {
        /* ignore */
      }
    }
    router.push('/rehearsal')
  }

  const v2: DialogueAnalysisV2 | undefined = data?.v2

  return (
    <div className="page page-stack dialogue-result-page">
      <header className="deep-header">
        <button type="button" className="deep-header__btn" aria-label="返回" onClick={() => router.push('/rehearsal')}>
          ←
        </button>
        <h1 className="deep-header__title">对话分析</h1>
        <button type="button" className="deep-header__btn" aria-label="关闭" onClick={() => router.push('/rehearsal')}>
          ×
        </button>
      </header>

      <div className="page-scroll">
        {loading ? (
          <div className="soft-card" style={{ textAlign: 'center', padding: 32 }}>
            <p className="hint-text">正在整理对话分析…</p>
          </div>
        ) : null}

        {error ? (
          <div className="soft-card" style={{ textAlign: 'center', padding: 32 }}>
            <p className="section-title">{error}</p>
            <button type="button" className="primary-button" onClick={() => router.push('/rehearsal')}>
              返回预演
            </button>
          </div>
        ) : null}

        {data?.status === 'failed' || data?.status === 'insufficient' ? (
          <div className="soft-card" style={{ padding: 24 }}>
            <p className="section-title">
              {data.status === 'insufficient' ? '这段录音还不够' : '分析没有完成'}
            </p>
            <p className="hint-text">{data.errorMessage || '请返回重试'}</p>
            <button type="button" className="primary-button" onClick={() => router.push('/rehearsal')}>
              返回预演
            </button>
          </div>
        ) : null}

        {data?.status === 'done' && v2 ? (
          <DialogueAnalysisV2View
            summary={data.summary}
            v2={v2}
            onGoRehearsal={goRehearsal}
            onBack={() => router.push('/rehearsal')}
          />
        ) : null}
      </div>
    </div>
  )
}

export default function DialogueResultPage() {
  return (
    <OnboardingGuard>
      <Suspense
        fallback={
          <div className="page page-stack dialogue-result-page">
            <div className="soft-card" style={{ textAlign: 'center', padding: 32 }}>
              <p className="hint-text">正在打开对话分析…</p>
            </div>
          </div>
        }
      >
        <DialogueResultInner />
      </Suspense>
    </OnboardingGuard>
  )
}
