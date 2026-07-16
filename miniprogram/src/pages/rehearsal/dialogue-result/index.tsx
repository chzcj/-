import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { AuthorityInsightCard } from '@/components/hifi/AuthorityInsightCard'
import { apiRequest } from '@/services/api'
import './index.scss'

type Segment = {
  speaker: string
  text: string
  highlight?: boolean
  highlightReason?: string
}

type AnalysisPayload = {
  analysisId: string
  status: string
  summary: string
  analysis: string
  tryTonight: string
  sampleDialogue: string
  segments: Segment[]
  rehearsalSeed?: Record<string, unknown>
  errorMessage?: string
}

function isChildSpeaker(speaker: string) {
  return speaker === '孩子'
}

export default function DialogueResultPage() {
  useSafeShareAppMessage({ title: '育见 · 对话分析' })
  const router = useRouter()
  const id = router.params.id || ''
  const [data, setData] = useState<AnalysisPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setError('缺少分析结果')
      setLoading(false)
      return
    }
    void (async () => {
      const res = await apiRequest<AnalysisPayload>(
        `/api/rehearsal/dialogue-analyze?id=${encodeURIComponent(id)}`
      )
      setLoading(false)
      if (!res.ok) {
        setError(res.error.message || '加载失败')
        return
      }
      setData({
        analysisId: res.data.analysisId,
        status: res.data.status,
        summary: res.data.summary,
        analysis: res.data.analysis,
        tryTonight: res.data.tryTonight,
        sampleDialogue: res.data.sampleDialogue,
        segments: res.data.segments || [],
        rehearsalSeed: res.data.rehearsalSeed,
        errorMessage: res.data.errorMessage,
      })
    })()
  }, [id])

  const goRehearsal = () => {
    try {
      if (data?.rehearsalSeed) {
        Taro.setStorageSync('childos_rehearsal_dialogue_context', data.rehearsalSeed)
      }
    } catch {
      /* ignore */
    }
    void Taro.switchTab({ url: '/pages/rehearsal/index' })
  }

  const goBackRehearsal = () => {
    void Taro.switchTab({ url: '/pages/rehearsal/index' })
  }

  const toggleSpeaker = (index: number) => {
    if (!data) return
    const next = data.segments.map((s, i) =>
      i === index ? { ...s, speaker: s.speaker === '孩子' ? '家长' : '孩子' } : s
    )
    setData({ ...data, segments: next })
  }

  return (
    <View className='dialogue-result-page'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title='对话分析'
        showClose
        onBack={goBackRehearsal}
        onClose={goBackRehearsal}
      />

      <ScrollView scrollY className='dialogue-result-scroll' enhanced showScrollbar={false}>
        <View className='dialogue-result-inner'>
          {loading ? (
            <View className='dialogue-state-panel'>
              <View className='dialogue-loader' />
              <Text className='dialogue-state-title'>正在整理对话分析</Text>
              <Text className='dialogue-state-text'>育见正在听你们刚才说了什么…</Text>
            </View>
          ) : null}

          {error ? (
            <View className='dialogue-state-panel dialogue-state-panel--error'>
              <Text className='dialogue-state-title'>暂时没能打开结果</Text>
              <Text className='dialogue-state-text'>{error}</Text>
              <Text className='pill block' onClick={goBackRehearsal}>
                返回预演
              </Text>
            </View>
          ) : null}

          {data?.status === 'failed' ? (
            <View className='dialogue-state-panel dialogue-state-panel--error'>
              <Text className='dialogue-state-title'>分析没有完成</Text>
              <Text className='dialogue-state-text'>{data.errorMessage || '分析失败'}</Text>
              <Text className='pill block' onClick={goBackRehearsal}>
                返回预演
              </Text>
            </View>
          ) : null}

          {data?.status === 'insufficient' ? (
            <View className='dialogue-state-panel dialogue-state-panel--muted'>
              <Text className='dialogue-state-title'>这段录音还不够</Text>
              <Text className='dialogue-state-text'>
                {data.errorMessage ||
                  '这段录音里没有听到有效的亲子对话，下次真实交流时再录一段就好。'}
              </Text>
              <Text className='pill block' onClick={goBackRehearsal}>
                返回预演
              </Text>
            </View>
          ) : null}

          {data && data.status === 'done' ? (
            <View className='dialogue-result-flow'>
              {data.summary ? (
                <View className='dialogue-overview'>
                  <Text className='dialogue-overview-kicker'>本次概览</Text>
                  <Text className='dialogue-overview-text'>{data.summary}</Text>
                </View>
              ) : null}

              <AuthorityInsightCard title='育见解读' body={data.analysis} />

              {data.tryTonight ? (
                <View className='dialogue-try-tonight'>
                  <Text className='dialogue-try-tonight-badge'>今晚可试</Text>
                  <Text className='dialogue-try-tonight-body'>{data.tryTonight}</Text>
                </View>
              ) : null}

              {data.sampleDialogue ? (
                <View className='dialogue-sample'>
                  <Text className='dialogue-section-title'>示范对话</Text>
                  <View className='dialogue-sample-script'>
                    <Text className='dialogue-sample-text'>{data.sampleDialogue}</Text>
                  </View>
                </View>
              ) : null}

              <View className='dialogue-timeline'>
                <View className='dialogue-timeline-head'>
                  <Text className='dialogue-section-title'>对话原文</Text>
                  <Text className='dialogue-timeline-hint'>点某段可切换「家长 / 孩子」</Text>
                </View>
                <View className='dialogue-timeline-body'>
                  {data.segments.map((seg, i) => {
                    const child = isChildSpeaker(seg.speaker)
                    return (
                      <View
                        key={`${i}-${seg.text.slice(0, 8)}`}
                        className={[
                          'dialogue-bubble-row',
                          child ? 'is-child' : 'is-parent',
                          seg.highlight ? 'is-highlight' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => toggleSpeaker(i)}
                      >
                        <View className='dialogue-bubble'>
                          <Text className='dialogue-bubble-speaker'>{seg.speaker}</Text>
                          <Text className='dialogue-bubble-text'>{seg.text}</Text>
                          {seg.highlightReason ? (
                            <Text className='dialogue-bubble-reason'>{seg.highlightReason}</Text>
                          ) : null}
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>

              <View className='dialogue-result-actions'>
                <Text className='pill primary block' onClick={goRehearsal}>
                  用这次对话去情景预演
                </Text>
                <Text className='pill block' onClick={goBackRehearsal}>
                  返回预演
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}
