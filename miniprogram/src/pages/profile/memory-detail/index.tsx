import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import type { MemoryMomentDetail } from '@/lib/handbookPack'
import { FEED_TYPE_LABEL } from '@/lib/handbookPack'
import { apiRequest } from '@/services/api'
import '@/styles/profile-handbook-sheet.scss'
import '../memories/index.scss'
import './index.scss'

export default function ProfileMemoryDetailPage() {
  const router = useRouter()
  const memoryId = router.params.id || ''
  useSafeShareAppMessage({ title: '育见 · 记忆详情' })
  const [detail, setDetail] = useState<MemoryMomentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!memoryId) return
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest<{ found?: boolean } & Partial<MemoryMomentDetail>>(
        `/api/profile/memory/${encodeURIComponent(memoryId)}`,
        { method: 'GET' }
      )
      if (res.ok && res.data.found !== false && res.data.title) {
        setDetail(res.data as MemoryMomentDetail)
        setNotFound(false)
      } else {
        setNotFound(true)
      }
    } catch {
      setError('加载失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [memoryId])

  const typeLabel = detail?.item?.type ? FEED_TYPE_LABEL[detail.item.type] : ''

  return (
    <View className='profile-subpage memory-detail-page'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title='记忆详情'
        showClose
        onBack={() => void Taro.navigateBack()}
        onClose={() => void Taro.switchTab({ url: '/pages/profile/index' })}
      />
      <ScrollView scrollY className='profile-sub-scroll'>
        {loading ? (
          <View className='sub-state'>
            <View className='loader' />
            <Text className='muted'>正在整理记忆…</Text>
          </View>
        ) : error ? (
          <View className='sub-error'>
            <Text className='muted'>{error}</Text>
            <Text className='sub-retry' onClick={() => void load()}>
              重试
            </Text>
          </View>
        ) : notFound || !detail ? (
          <View className='sub-state'>
            <Text className='muted'>这条记忆暂时找不到，可能已被整理归档。</Text>
          </View>
        ) : (
          <>
            <View className='memory-detail-hero'>
              <View className='memory-detail-hero-top'>
                <Text className='memory-detail-kicker'>{detail.kicker || typeLabel || '手账记忆'}</Text>
                {typeLabel ? <Text className='memory-detail-type'>{typeLabel}</Text> : null}
              </View>
              <Text className='memory-detail-title'>{detail.title}</Text>
              {detail.lead ? <Text className='memory-detail-lead'>{detail.lead}</Text> : null}
            </View>

            {detail.item.type === 'voice' ? (
              <View className='play-row'>
                <View className='play-btn'>
                  <Text>▶</Text>
                </View>
                <View className='play-wave' />
              </View>
            ) : null}

            {detail.whyIncluded ? (
              <View className='detail-section-card is-open'>
                <View className='detail-section-head'>
                  <View className='detail-section-index'>
                    <Text>01</Text>
                  </View>
                  <Text className='detail-section-title'>为什么进手账</Text>
                </View>
                <View className='detail-section-body memory-detail-body'>
                  <Text className='memory-detail-prose'>{detail.whyIncluded}</Text>
                </View>
              </View>
            ) : null}

            {detail.evidenceBody ? (
              <View className='detail-section-card is-open'>
                <View className='detail-section-head'>
                  <View className='detail-section-index'>
                    <Text>02</Text>
                  </View>
                  <Text className='detail-section-title'>原文摘录</Text>
                </View>
                <View className='detail-section-body memory-detail-body detail-evidence-body'>
                  <Text className='memory-detail-prose memory-detail-evidence'>{detail.evidenceBody}</Text>
                </View>
              </View>
            ) : detail.whyIncluded ? (
              <View className='detail-section-card is-open detail-section-card--muted'>
                <View className='detail-section-head'>
                  <View className='detail-section-index'>
                    <Text>02</Text>
                  </View>
                  <Text className='detail-section-title'>原文摘录</Text>
                </View>
                <View className='detail-section-body memory-detail-body'>
                  <Text className='muted memory-detail-prose'>
                    本条缺少可溯源原话，暂不展示「原文摘录」。若只是标签或摘要，不会当作家长当时说的话。
                  </Text>
                </View>
              </View>
            ) : null}

            {detail.keyQuotes?.length ? (
              <View className='detail-section-card is-open'>
                <View className='detail-section-head'>
                  <View className='detail-section-index'>
                    <Text>{detail.evidenceBody || detail.whyIncluded ? '03' : '02'}</Text>
                  </View>
                  <Text className='detail-section-title'>提炼关键句</Text>
                </View>
                <View className='detail-section-body detail-facts-body'>
                  {detail.keyQuotes.map((q) => (
                    <View key={q} className='detail-fact-quote'>
                      <Text className='detail-fact-text'>{q}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {detail.interpretation ? (
              <View className='detail-section-card is-open detail-interpret-card'>
                <View className='detail-section-head'>
                  <View className='detail-section-index detail-section-index--facts'>
                    <Text>✦</Text>
                  </View>
                  <Text className='detail-section-title'>轻解读</Text>
                </View>
                <View className='detail-section-body memory-detail-body'>
                  <Text className='memory-detail-prose'>{detail.interpretation}</Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}
