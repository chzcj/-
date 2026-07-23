import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { useHandbookPack } from '@/hooks/useHandbookPack'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import '@/styles/profile-handbook-sheet.scss'
import '../memories/index.scss'
import './index.scss'

const HB_ROWS = [
  { key: 'highlight', label: '阶段性亮点', icon: '✦' },
  { key: 'relationMoment', label: '关系瞬间', icon: '♡' },
  { key: 'compareLastWeek', label: '对比上次', icon: '↔' },
] as const

export default function ProfileHandbookPage() {
  useSafeShareAppMessage({ title: '育见 · 近7天手账' })
  const { pack, loading, refreshing, error, retry } = useHandbookPack()
  const handbook = pack?.handbook
  const heroCopy = pack?.hero?.heroCopy || ''

  return (
    <View className='profile-subpage handbook-page'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title='近7天手账'
        showClose
        onBack={() => void Taro.navigateBack()}
        onClose={() => void Taro.switchTab({ url: '/pages/profile/index' })}
      />
      {refreshing ? (
        <Text className='sheet-kicker' style={{ padding: '0 32rpx 8rpx', display: 'block' }}>
          更新中…
        </Text>
      ) : null}
      <ScrollView scrollY enhanced showScrollbar={false} className='profile-sub-scroll'>
        {loading && !handbook && !heroCopy ? (
          <View className='sub-state'>
            <View className='loader' />
            <Text className='muted'>正在整理手账…</Text>
          </View>
        ) : error && !handbook && !heroCopy ? (
          <View className='sub-error'>
            <Text className='muted'>{error}</Text>
            <Text className='sub-retry' onClick={() => void retry()}>
              重试
            </Text>
          </View>
        ) : (
          <>
            <View className='sheet-head-block'>
              <Text className='sheet-kicker'>{handbook?.weekRangeLabel || '近7天'}</Text>
              <Text className='sheet-title'>{handbook?.headline || '近7天还在积累记忆'}</Text>
              <Text className='sheet-lead'>{handbook?.coverBlurb || heroCopy}</Text>
            </View>
            {handbook?.coverStory ? (
              <View className='sheet-block'>
                <Text className='sheet-block-label'>封面故事</Text>
                <Text className='sheet-block-body'>{handbook.coverStory}</Text>
              </View>
            ) : null}
            {HB_ROWS.map((row) => (
              <View key={row.key} className='hb-icon-row'>
                <View className='hb-icon-badge'>
                  <Text>{row.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text className='hb-icon-label'>{row.label}</Text>
                  <Text className='hb-icon-text'>
                    {handbook?.[row.key] ||
                      (row.key === 'compareLastWeek'
                        ? '积累足够记忆后，可与上一阶段对比回看。'
                        : '继续记录后，近7天内容会出现在这里。')}
                  </Text>
                </View>
              </View>
            ))}
            {handbook?.weekInventory?.length ? (
              <View className='sheet-block'>
                <Text className='sheet-block-label'>近7天清单</Text>
                {handbook.weekInventory.map((line) => (
                  <Text key={line} className='sheet-block-body'>
                    · {line}
                  </Text>
                ))}
              </View>
            ) : null}
            <View
              className='sub-retry'
              style={{ textAlign: 'center', marginTop: '16rpx' }}
              onClick={() => void Taro.navigateTo({ url: '/pages/profile/memories/index?scope=recent' })}
            >
              <Text>查看近7天全部记忆 ›</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
