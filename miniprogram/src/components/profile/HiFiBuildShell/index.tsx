import { ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import { HiFiMascot } from '@/components/hifi/HiFiMascot'
import { usePageEntering } from '@/hooks/usePageEntering'
import './index.scss'

export type HiFiAction = {
  id?: string
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'quiet'
  disabled?: boolean
}

type HiFiBuildShellProps = {
  topTitle: string
  stepLabel: string
  progress: number
  children: ReactNode
  actions?: HiFiAction[]
}

/** 对齐 Web HiFiBuildShell：grid 壳层 + 底部 actions 在文档流内（非悬浮条） */
export function HiFiBuildShell({
  topTitle,
  stepLabel,
  progress,
  children,
  actions = [],
}: HiFiBuildShellProps) {
  const entering = usePageEntering()
  const pageClass = `page${entering ? ' page-entering' : ''}`

  return (
    <View className='hifi-build-root'>
      <View className='app-shell' aria-label={topTitle}>
        <View className='app-safe-top' />
        <View className='progress-wrap' aria-label='采集进度'>
          <View className='progress-track'>
            <View className='progress-bar' style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </View>
          <Text className='progress-step-label'>{stepLabel}</Text>
        </View>
        <View className={pageClass}>{children}</View>
        {actions.length > 0 ? (
          <View className={`bottom-actions hifi-bottom-actions${actions.length > 2 ? ' dense' : ''}`}>
            {actions.map((action, i) => {
              const className =
                action.variant === 'quiet'
                  ? 'quiet-button'
                  : action.variant === 'secondary'
                    ? 'secondary-button'
                    : 'primary-button'
              return (
                <View
                  key={action.id || `${action.variant || 'primary'}-${i}`}
                  className={`${className}${action.disabled ? ' disabled' : ''}`}
                  onClick={() => {
                    if (!action.disabled) action.onClick()
                  }}
                >
                  <Text>{action.label}</Text>
                </View>
              )
            })}
          </View>
        ) : null}
      </View>
    </View>
  )
}

type HiFiBuildHeroProps = {
  kicker?: string
  title: string
  copy?: string
  compact?: boolean
  mascot?: boolean
}

/** 对齐 Web HiFiBuildHero：hero-card + module-kicker + 吉祥物 */
export function HiFiBuildHero({ kicker, title, copy, compact, mascot = true }: HiFiBuildHeroProps) {
  return (
    <View className={`hero-card${compact ? ' compact' : ''}${mascot ? ' has-mascot' : ''}`}>
      {kicker ? <Text className='module-kicker'>{kicker}</Text> : null}
      <Text className='hero-title'>{title}</Text>
      {copy ? <Text className='hero-copy'>{copy}</Text> : null}
      {mascot ? <HiFiMascot /> : null}
    </View>
  )
}
