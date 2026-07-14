import { ReactNode } from 'react'
import { View, Text, Button } from '@tarojs/components'
import './index.scss'

type OnboardingInfoShellProps = {
  step: number
  totalSteps: number
  actionLabel: string
  onAction: () => void
  children: ReactNode
}

export function OnboardingInfoShell({
  step,
  totalSteps,
  actionLabel,
  onAction,
  children,
}: OnboardingInfoShellProps) {
  return (
    <View className='onboarding-info-root'>
      <View className='onboarding-info-bg' aria-hidden />
      <View className='app-safe-top' />
      <View className='onboarding-info-body'>
        <View className='onboarding-info-dots' aria-label={`第 ${step} 步，共 ${totalSteps} 步`}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <View
              key={i}
              className={`onboarding-info-dot${i + 1 === step ? ' is-active' : ''}`}
            />
          ))}
        </View>

        <View className='onboarding-info-scroll'>
          <View className='onboarding-info-card'>{children}</View>
        </View>

        <Button className='onboarding-info-cta' onClick={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      </View>
    </View>
  )
}
