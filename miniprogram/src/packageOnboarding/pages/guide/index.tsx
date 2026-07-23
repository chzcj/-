import { useLoad } from '@tarojs/taro'
import { View } from '@tarojs/components'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import './index.scss'

/** 旧路由兼容：guide 已合并进 intro */
export default function OnboardingGuideRedirect() {
  useLoad(() => {
    void mpGoReplace('/packageOnboarding/pages/intro/index')
  })

  return <View className='onboarding-guide-redirect' />
}
