import Taro, { useLoad } from '@tarojs/taro'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'

/** 旧单页 build 入口 → hub */
export default function OnboardingBuildRedirect() {
  useSafeShareAppMessage()
  useLoad(() => {
    Taro.redirectTo({ url: '/packageOnboarding/pages/hub/index' })
  })
  return null
}
