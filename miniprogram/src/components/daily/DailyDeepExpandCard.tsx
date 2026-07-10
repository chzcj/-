import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Textarea } from '@tarojs/components'
import type { DailySection } from '@yujian/contracts'
import { apiRequest } from '@/services/api'
import { DailySectionView } from './DailySectionView'

type DailyDeepExpandCardProps = {
  sections: DailySection[]
  traceId?: string
  onClose?: () => void
}

export function DailyDeepExpandCard({ sections, traceId, onClose }: DailyDeepExpandCardProps) {
  const [feedback, setFeedback] = useState<'accurate' | 'partial' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [partialOpen, setPartialOpen] = useState(false)
  const [partialNote, setPartialNote] = useState('')
  const [toast, setToast] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!traceId) return
    const firedKey = `childos_deep_expand_fired_${traceId}`
    try {
      if (Taro.getStorageSync(firedKey)) return
      Taro.setStorageSync(firedKey, '1')
    } catch {
      /* ignore */
    }
    void apiRequest('/api/daily/deep-expand', {
      method: 'POST',
      data: { traceId },
    })
  }, [traceId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  async function postFeedback(kind: 'accurate' | 'partial', note?: string) {
    const sectionIds = sections.map((s) => s.id)
    if (!traceId) {
      setToast('已记录在本机；回到交流再生成一轮后可同步到服务器。')
      return
    }
    const res = await apiRequest<{ ok?: boolean }>('/api/daily/section-feedback', {
      method: 'POST',
      data: { traceId, kind, sectionIds, note: note?.trim() || undefined },
    })
    setToast(
      res.ok
        ? kind === 'accurate'
          ? '收到了，我会更按这个方向理解。'
          : note?.trim()
            ? '收到了，这条校正会进入记忆。'
            : '收到了，已记下不太像。'
        : '反馈已记下；若未同步成功，可再试一次。'
    )
  }

  if (!sections.length) return null

  return (
    <View className='deep-expand-card'>
      <View className='deep-expand-card-header'>
        <View className='deep-expand-toggle' onClick={() => setCollapsed((v) => !v)}>
          <Text className='section-label'>深度展开</Text>
          <Text className='deep-expand-chevron'>{collapsed ? '▸' : '▾'}</Text>
        </View>
        {onClose ? (
          <Text className='deep-expand-close' onClick={onClose}>
            ×
          </Text>
        ) : null}
      </View>

      {!collapsed ? (
        <View>
          <View className='deep-expand-body'>
            {sections.map((section) => (
              <DailySectionView key={section.id} section={section} />
            ))}
          </View>
          <View className='suggestion-strip deep-expand-feedback'>
            <Text
              className={`pill${feedback === 'accurate' ? ' primary' : ''}`}
              onClick={() => {
                if (submitting || feedback) return
                setSubmitting(true)
                setFeedback('accurate')
                void postFeedback('accurate').finally(() => setSubmitting(false))
              }}
            >
              这段像我家情况
            </Text>
            <Text
              className={`pill${feedback === 'partial' ? ' primary' : ''}`}
              onClick={() => {
                if (submitting || feedback) return
                setPartialOpen(true)
              }}
            >
              哪里不太像
            </Text>
          </View>
          {partialOpen ? (
            <View className='deep-expand-partial'>
              <Textarea
                className='deep-expand-note'
                value={partialNote}
                placeholder='说说哪里不太像（可留空）'
                maxlength={500}
                onInput={(e) => setPartialNote(e.detail.value)}
              />
              <View className='suggestion-strip'>
                <Text
                  className='pill'
                  onClick={() => {
                    if (submitting) return
                    setSubmitting(true)
                    setPartialOpen(false)
                    setFeedback('partial')
                    void postFeedback('partial', partialNote).finally(() => setSubmitting(false))
                  }}
                >
                  提交校正
                </Text>
                <Text
                  className='pill'
                  onClick={() => {
                    if (submitting) return
                    setSubmitting(true)
                    setPartialOpen(false)
                    setFeedback('partial')
                    void postFeedback('partial').finally(() => setSubmitting(false))
                  }}
                >
                  先记不太像
                </Text>
              </View>
            </View>
          ) : null}
          {toast ? <Text className='deep-expand-toast'>{toast}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}
