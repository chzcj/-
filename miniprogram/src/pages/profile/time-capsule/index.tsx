import { ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { useHandbookPack } from '@/hooks/useHandbookPack'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import '@/styles/profile-handbook-sheet.scss'
import '../memories/index.scss'

export default function ProfileTimeCapsulePage() {
  useSafeShareAppMessage({ title: '育见 · 对比上次' })
  const { pack, loading, error, retry } = useHandbookPack()
  const snap = pack?.timeCapsuleSnapshot

  return (
    <View className='profile-subpage capsule-page'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title='对比上次'
        showClose
        onBack={() => void Taro.navigateBack()}
        onClose={() => void Taro.switchTab({ url: '/pages/profile/index' })}
      />
      <ScrollView scrollY className='profile-sub-scroll'>
        {loading && !snap ? (
          <View className='sub-state'>
            <View className='loader' />
            <Text className='muted'>正在整理对比…</Text>
          </View>
        ) : error && !snap ? (
          <View className='sub-error'>
            <Text className='muted'>{error}</Text>
            <Text className='sub-retry' onClick={() => void retry()}>
              重试
            </Text>
          </View>
        ) : snap ? (
          <>
            <View className='sheet-head-block'>
              <Text className='sheet-lead'>
                把同一件事的「那时」和「此刻」叠在一起看——文字再长也能整段读完。
              </Text>
            </View>
            <View className='compare-card compare-card--then'>
              <Text className='compare-tag'>
                <Text className='compare-tag-dot' />
                {snap.thenLabel}
              </Text>
              <Text className='sheet-block-body'>{snap.thenSnapshot}</Text>
              {snap.thenQuote ? (
                <Text className='mini-card-kicker'>「{snap.thenQuote}」</Text>
              ) : null}
            </View>
            <View className='compare-bridge'>
              <Text className='compare-bridge-label'>慢慢变成了</Text>
            </View>
            <View className='compare-card compare-card--now'>
              <Text className='compare-tag compare-tag--now'>
                <Text className='compare-tag-dot' />
                {snap.nowLabel}
              </Text>
              <Text className='sheet-block-body'>{snap.nowSnapshot}</Text>
              {snap.relationShift ? (
                <Text className='mini-card-kicker'>{snap.relationShift}</Text>
              ) : null}
            </View>
          </>
        ) : (
          <View className='sub-state'>
            <Text className='sheet-lead'>
              还没有足够的记忆来做对比。继续记录后，这里会出现「那时 vs 现在」的回看。
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
