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
      <Text className='onboarding-info-badge'>开始前说明</Text>
      <Text className='onboarding-info-title'>用真实生活，让育见认识孩子</Text>
      <Text className='onboarding-info-paragraph'>
        接下来会从日常安排、写作业、亲子沟通、家庭习惯四个方面了解孩子。按真实过程说就行，不用总结性格，也不用写成报告。
      </Text>

      <View className='onboarding-info-tip'>
        <Text className='onboarding-info-tip-title'>建议按住语音按钮，顺着讲</Text>
        <Text className='onboarding-info-tip-copy'>
          多讲一点当时发生什么、谁说了什么、后来怎样结束。具体生活细节越多，后面的理解越贴近你家。
        </Text>
      </View>

      <Text className='onboarding-info-paragraph'>
        后面还能继续补充。育见会随着交流、任务和预演，一点点形成更贴近孩子的成长理解。
      </Text>
    </OnboardingInfoShell>
  )
}
