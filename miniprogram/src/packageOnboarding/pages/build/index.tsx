import Taro, { useLoad } from '@tarojs/taro'

/** 旧单页 build 入口 → hub */
export default function OnboardingBuildRedirect() {
  useLoad(() => {
    Taro.redirectTo({ url: '/packageOnboarding/pages/hub/index' })
  })
  return null
}
