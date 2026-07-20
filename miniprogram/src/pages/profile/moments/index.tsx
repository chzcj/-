import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { HandbookEmptyState } from '@/components/profile/HandbookEmptyState'
import { useHandbookPack } from '@/hooks/useHandbookPack'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import '@/styles/profile-handbook-sheet.scss'
import '../memories/index.scss'

export default function ProfileMomentsPage() {
  useSafeShareAppMessage({ title: '育见 · 闪光时刻' })
  const { pack, loading, error, retry } = useHandbookPack()
  const moments = pack?.highlightMoments || []

  return (
    <View className='profile-subpage'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title='闪光时刻'
        showClose
        onBack={() => void Taro.navigateBack()}
        onClose={() => void Taro.switchTab({ url: '/pages/profile/index' })}
      />
      <ScrollView scrollY className='profile-sub-scroll'>
        {loading && !moments.length ? (
          <View className='sub-state'>
            <View className='loader' />
            <Text className='muted'>正在整理闪光时刻…</Text>
          </View>
        ) : error && !moments.length ? (
          <View className='sub-error'>
            <Text className='muted'>{error}</Text>
            <Text className='sub-retry' onClick={() => void retry()}>
              重试
            </Text>
          </View>
        ) : moments.length ? (
          <View className='moments-list'>
            {moments.map((m, i) => (
              <View key={`${m.title}-${i}`} className='sheet-shine-block'>
                <Text className='mini-card-title'>{m.title}</Text>
                <Text className='mini-card-body'>{m.teaser}</Text>
                {m.whyHighlighted ? (
                  <Text className='mini-card-kicker'>{m.whyHighlighted}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <HandbookEmptyState variant='moments' />
        )}
      </ScrollView>
    </View>
  )
}
