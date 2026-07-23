import { ReactNode } from 'react'
import { View, Button, Text } from '@tarojs/components'
import './index.scss'

type OnboardingInfoShellProps = {
  actionLabel: string
  onAction: () => void
  children: ReactNode
}

export function OnboardingInfoShell({ actionLabel, onAction, children }: OnboardingInfoShellProps) {
  return (
    <View className='onboarding-info-root'>
      <View className='onboarding-info-bg' aria-hidden />
      <View className='app-safe-top' />
      <View className='onboarding-info-body'>
        <View className='onboarding-info-scroll-wrap'>
          <View className='onboarding-info-scroll'>
            <View className='onboarding-info-card'>{children}</View>
          </View>
        </View>

        <Button className='onboarding-info-cta' onClick={onAction}>
          <Text>{actionLabel}</Text>
        </Button>
      </View>
    </View>
  )
}
