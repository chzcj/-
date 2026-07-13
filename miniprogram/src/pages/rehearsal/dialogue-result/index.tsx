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
        onBack={() => void Taro.switchTab({ url: '/pages/rehearsal/index' })}
        onClose={() => void Taro.switchTab({ url: '/pages/rehearsal/index' })}
      />

      <ScrollView scrollY className='dialogue-result-scroll'>
        {loading ? <Text className='muted'>加载中…</Text> : null}
        {error ? <Text className='dialogue-error'>{error}</Text> : null}

        {data?.status === 'failed' ? (
          <Text className='dialogue-error'>{data.errorMessage || '分析失败'}</Text>
        ) : null}

        {data?.status === 'insufficient' ? (
          <View className='soft-card'>
            <Text className='soft-card-body'>
              {data.errorMessage || '这段录音里没有听到有效的亲子对话，下次真实交流时再录一段就好。'}
            </Text>
          </View>
        ) : null}

        {data && data.status === 'done' ? (
          <>
            {data.summary ? (
              <View className='soft-card'>
                <Text className='section-label'>本次概览</Text>
                <Text className='soft-card-body'>{data.summary}</Text>
              </View>
            ) : null}

            <AuthorityInsightCard title='育见解读' body={data.analysis} />

            {data.tryTonight ? (
              <View className='soft-card'>
                <Text className='section-label'>今晚可以试</Text>
                <Text className='soft-card-body'>{data.tryTonight}</Text>
              </View>
            ) : null}

            {data.sampleDialogue ? (
              <View className='soft-card'>
                <Text className='section-label'>示范对话</Text>
                <Text className='soft-card-body sample-dialogue'>{data.sampleDialogue}</Text>
              </View>
            ) : null}

            <View className='soft-card'>
              <Text className='section-label'>对话原文</Text>
              <Text className='hint-text'>点某段可切换「家长 / 孩子」</Text>
              {data.segments.map((seg, i) => (
                <View
                  key={`${i}-${seg.text.slice(0, 8)}`}
                  className={seg.highlight ? 'dialogue-line highlight' : 'dialogue-line'}
                  onClick={() => toggleSpeaker(i)}
                >
                  <Text className='dialogue-speaker'>{seg.speaker}</Text>
                  <Text className='dialogue-text'>{seg.text}</Text>
                  {seg.highlightReason ? (
                    <Text className='dialogue-reason'>{seg.highlightReason}</Text>
                  ) : null}
                </View>
              ))}
            </View>

            <View className='dialogue-result-actions'>
              <Text className='pill primary' onClick={goRehearsal}>
                用这次对话去情景预演
              </Text>
              <Text
                className='pill'
                onClick={() => void Taro.switchTab({ url: '/pages/rehearsal/index' })}
              >
                返回预演
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}
