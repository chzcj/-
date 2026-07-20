import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { HandbookEmptyState } from '@/components/profile/HandbookEmptyState'
import { useHandbookPack } from '@/hooks/useHandbookPack'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { FEED_TYPE_LABEL, type MemoryFeedItem } from '@/lib/handbookPack'
import '@/styles/profile-handbook-sheet.scss'
import './index.scss'

function formatAxis(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: value, mon: '' }
  return {
    day: `${date.getDate()}日`,
    mon: `${date.getMonth() + 1}月`,
  }
}

function feedTitle(item: MemoryFeedItem) {
  return item.displayLine || item.title || item.keyword
}

export default function ProfileMemoriesPage() {
  const router = useRouter()
  const scope = router.params.scope === 'recent' ? 'recent' : 'all'
  const isRecent = scope === 'recent'

  useSafeShareAppMessage({
    title: isRecent ? '育见 · 近7天记忆' : '育见 · 手账记忆',
  })
  const { pack, loading, refreshing, error, retry } = useHandbookPack()
  const items = isRecent ? pack?.memoryFeedRecent || [] : pack?.memoryFeed || []
  const rangeLabel = pack?.handbook?.weekRangeLabel

  const openDetail = (id: string) => {
    void Taro.navigateTo({ url: `/pages/profile/memory-detail/index?id=${encodeURIComponent(id)}` })
  }

  return (
    <View className='profile-subpage'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title={isRecent ? '近7天记忆' : '手账记忆'}
        showClose
        onBack={() => void Taro.navigateBack()}
        onClose={() => void Taro.switchTab({ url: '/pages/profile/index' })}
      />
      {refreshing ? (
        <Text className='sheet-kicker' style={{ padding: '0 32rpx 8rpx', display: 'block' }}>
          更新中…
        </Text>
      ) : null}
      <ScrollView scrollY className='profile-sub-scroll'>
        {loading && !items.length ? (
          <View className='sub-state'>
            <View className='loader' />
            <Text className='muted'>正在整理手账记忆…</Text>
          </View>
        ) : error && !items.length ? (
          <View className='sub-error'>
            <Text className='muted'>{error}</Text>
            <Text className='sub-retry' onClick={() => void retry()}>
              重试
            </Text>
          </View>
        ) : items.length ? (
          <>
            <Text className='sheet-lead' style={{ marginBottom: '24rpx' }}>
              {isRecent
                ? `${rangeLabel || '近7天'} · 共 ${items.length} 条`
                : `共 ${items.length} 条 · 按时间倒序`}
            </Text>
            <View className='mem-list'>
              {items.map((item) => {
                const axis = formatAxis(item.occurredAt)
                return (
                  <View key={item.id} className='mem-row' onClick={() => openDetail(item.id)}>
                    <View className='mem-axis'>
                      <Text className='mem-axis-day'>{axis.day}</Text>
                      <Text className='mem-axis-mon'>{axis.mon}</Text>
                      <View className='mem-axis-dot' />
                    </View>
                    <View className='mem-card'>
                      <View className='mem-card-top'>
                        <Text className='mem-card-kw'>{feedTitle(item)}</Text>
                        <Text className='mem-card-type'>{FEED_TYPE_LABEL[item.type]}</Text>
                      </View>
                      {item.teaser || item.snippet ? (
                        <Text className='mem-card-desc'>{item.teaser || item.snippet}</Text>
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        ) : (
          <HandbookEmptyState variant='memories' />
        )}
      </ScrollView>
    </View>
  )
}
