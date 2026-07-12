import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { apiRequest } from '@/services/api'
import { loadDailyThread } from '@/services/dailyStream'
import './index.scss'

type Opening = { wording: string; reason: string }
type GuideSection = { title: string; body: string }

type GuideData = {
  intro?: string
  openings: Opening[]
  sections?: GuideSection[]
}

export default function HowToSpeakPage() {
  useSafeShareAppMessage({ title: '育见 · 和孩子一起聊聊今天' })
  const router = useRouter()
  const traceId = (router.params.traceId || '').trim()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [guide, setGuide] = useState<GuideData | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setError('')

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

      const res = await apiRequest<GuideData>('/api/daily/how-to-speak', {
        method: 'POST',
        data: { traceId, parentText, assistantReply },
      })
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        setError(res.error.message || '指南暂时没有生成出来')
        return
      }
      setGuide(res.data)
    })()

    return () => {
      cancelled = true
    }
  }, [traceId])

  return (
    <HiFiMainShell showInput={false}>
      <View className='how-to-speak-page'>
        <View className='how-to-speak-header'>
          <Text className='pill' onClick={() => void Taro.switchTab({ url: '/pages/daily/index' })}>
            返回交流
          </Text>
          <Text className='section-label'>我现在怎么开口</Text>
        </View>

        {loading ? (
          <View className='message-row ai'>
            <View className='bubble'>
              <Text className='muted'>正在生成开口指南…</Text>
            </View>
          </View>
        ) : null}

        {!loading && error ? <Text className='hint-text'>{error}</Text> : null}

        {!loading && guide ? (
          <View>
            {guide.intro ? <Text className='hero-copy'>{guide.intro}</Text> : null}

            {guide.sections?.map((section) => (
              <View key={section.title} className='hifi-card profile-block'>
                <Text className='section-label'>{section.title}</Text>
                <Text className='soft-card-body'>{section.body}</Text>
              </View>
            ))}

            <View className='how-to-speak-list'>
              {guide.openings.map((item, index) => (
                <View key={`${item.wording.slice(0, 12)}-${index}`} className='hint-block'>
                  <Text className='section-label'>说法 {index + 1}</Text>
                  <Text className='soft-card-body'>{item.wording}</Text>
                  <Text className='how-to-speak-reason'>为什么：{item.reason}</Text>
                </View>
              ))}
            </View>

            <Text
              className='pill primary'
              style={{ marginTop: '16px' }}
              onClick={() => void Taro.switchTab({ url: '/pages/daily/index' })}
            >
              回到交流继续聊
            </Text>
          </View>
        ) : null}
      </View>
    </HiFiMainShell>
  )
}
