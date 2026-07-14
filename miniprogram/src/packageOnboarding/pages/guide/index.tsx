import { Text, View } from '@tarojs/components'
import { OnboardingInfoShell } from '@/components/onboarding/OnboardingInfoShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { getSessionToken } from '@/services/api'
import { markIntroSeen } from '@/services/onboardingFlags'
import { syncBuildProgressToServer } from '@/services/buildState'
import './index.scss'

export default function OnboardingGuide() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })

  const handleStart = async () => {
    markIntroSeen()
    if (getSessionToken()) {
      await syncBuildProgressToServer({ introSeen: true }).catch(() => {})
    }
    await mpGoReplace('/packageOnboarding/pages/hub/index')
  }

  return (
    <OnboardingInfoShell
      step={2}
      totalSteps={2}
      actionLabel='开始'
      onAction={() => void handleStart()}
    >
      <Text className='onboarding-info-badge'>正式开始前</Text>
      <Text className='onboarding-info-title'>先花 10 分钟，让育见认识你的孩子</Text>
      <Text className='onboarding-info-paragraph'>
        接下来大约需要 10 分钟。请按真实过程讲讲孩子的日常、作业、沟通和家庭支持，不用总结性格，也不用写成报告。
      </Text>

      <View className='onboarding-info-tip'>
        <Text className='onboarding-info-tip-title'>建议您按住语音按钮，多说一会儿</Text>
        <Text className='onboarding-info-tip-copy'>
          每次尽量说 30 秒以上，把关于孩子的小细节、家庭相处方式、教育中的困惑和期待，多告诉我们一些。
        </Text>
      </View>

      <Text className='onboarding-info-paragraph'>
        说得越具体，育见越能形成
        <Text className='onboarding-info-em'>更精准的专属成长画像</Text>
        ，并在后续交流中
        <Text className='onboarding-info-em'>越来越懂孩子</Text>
        。
      </Text>
    </OnboardingInfoShell>
  )
}
