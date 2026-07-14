import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import './index.scss'

const CHAIN_URL = '/pages/profile/card/index?id=growth&tab=chain'

/** 机制链已合并进统一详情壳；本页仅作兼容重定向（避免重依赖导致分包 chunk 加载失败） */
export default function ProfileDeepRedirectPage() {
  useEffect(() => {
    void Taro.redirectTo({ url: CHAIN_URL }).catch(() => {
      void Taro.navigateTo({ url: CHAIN_URL }).catch(() => {
        void Taro.switchTab({ url: '/pages/profile/index' })
      })
    })
  }, [])

  return (
    <View className='loading-wrap'>
      <View className='loader' />
      <Text className='muted'>正在打开机制链…</Text>
    </View>
  )
}
