import { View, Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { apiRequest } from '@/services/api'
import { canAccessProfileGenerating } from '@/services/entryStorage'
import { runProfileGeneratingPipeline } from '@/services/profilePipeline'

const STEPS = [
  '整理四个模块的关键事实',
  '跨模块综合建模',
  '深度建模与机制复核',
  '生成条件化孩子画像',
  '整理家庭支持重点',
]

export default function OnboardingGenerating() {
  const [allowed, setAllowed] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    setAllowed(false)
    setError('')

    void (async () => {
      const built = await apiRequest<{
        snapshot?: { coreJudgment?: string }
        onboardingComplete?: boolean
      }>('/api/profile/built', { method: 'GET' })

      if (cancelledRef.current) return

      if (built.ok && built.data.snapshot?.coreJudgment?.trim()) {
        await mpGoReplace('/packageOnboarding/pages/result/index')
        return
      }

      if (!canAccessProfileGenerating()) {
        await mpGoReplace('/packageOnboarding/pages/hub/index')
        return
      }

      setAllowed(true)
      setStep(0)
      const result = await runProfileGeneratingPipeline((s, label) => {
        if (!cancelledRef.current) setStep(s)
      })

      if (cancelledRef.current) return

      if (!result.ok) {
        setError(result.message)
        return
      }

      setStep(4)
      await mpGoReplace('/packageOnboarding/pages/result/index')
    })()

    return () => {
      cancelledRef.current = true
    }
  }, [retryKey])

  const handleRetry = () => setRetryKey((k) => k + 1)

  if (!allowed && !error) {
    return (
      <HiFiBuildShell topTitle='正在生成孩子画像' stepLabel='建模中' progress={96}>
        <View className='loading-wrap'>
          <View className='loader' />
          <Text className='loading-title'>正在进入画像生成…</Text>
        </View>
      </HiFiBuildShell>
    )
  }

  return (
    <HiFiBuildShell
      topTitle={error ? '画像没有生成成功' : '正在生成孩子画像'}
      stepLabel='建模中'
      progress={96 + Math.min(step, 4)}
      actions={
        error
          ? [
              { id: 'retry', label: '重试', onClick: handleRetry },
              {
                id: 'back',
                label: '返回采集',
                variant: 'secondary',
                onClick: () => void mpGoReplace('/packageOnboarding/pages/hub/index'),
              },
            ]
          : []
      }
    >
      <HiFiBuildHero
        kicker='建模中'
        title='正在综合四个模块'
        copy={
          error
            ? '可以重试一次，或返回继续补充模块信息。'
            : '四个模块的信息正在综合，请稍候片刻。'
        }
        compact
        mascot={!error}
      />

      {!error ? (
        <View className='soft-card'>
          {STEPS.map((label, i) => (
            <Text key={label} className={`step-pill${i < step ? ' done' : ''}${i === step ? ' active' : ''}`}>
              {label}
            </Text>
          ))}
          <View className='loading-dots'>
            <View className='loading-dot' />
            <View className='loading-dot' />
            <View className='loading-dot' />
          </View>
          <Text className='hint-text'>正在调用 AI 生成中，通常需要 30～60 秒</Text>
        </View>
      ) : (
        <View className='soft-card'>
          <Text className='soft-card-body'>{error}</Text>
        </View>
      )}
    </HiFiBuildShell>
  )
}
