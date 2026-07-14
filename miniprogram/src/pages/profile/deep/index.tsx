import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import './index.scss'

/** 机制链已合并进统一详情壳；本页仅作兼容重定向 */
export default function ProfileDeepRedirectPage() {
  useEffect(() => {
    void Taro.redirectTo({
      url: '/pages/profile/card/index?id=growth&tab=chain',
    }).catch(() => {
      void Taro.switchTab({ url: '/pages/profile/index' })
    })
  }, [])

  return (
    <HiFiMainShell surface='white' showInput={false}>
      <View className='loading-wrap'>
        <View className='loader' />
        <Text className='muted'>正在打开机制链…</Text>
      </View>
    </HiFiMainShell>
  )
}
