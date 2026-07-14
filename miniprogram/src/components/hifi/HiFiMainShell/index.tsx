import { ReactNode } from 'react'
import { View } from '@tarojs/components'
import { usePageEntering } from '@/hooks/usePageEntering'
import './index.scss'

type HiFiMainShellProps = {
  children: ReactNode
  inputZone?: ReactNode
  showInput?: boolean
  /** 无底部 Tab 的页面（如登录）设为 false，避免多余底留白 */
  withTabBar?: boolean
  surface?: 'default' | 'white'
  /** 禁用进场动画（如流式更新频繁的子页） */
  disableEntering?: boolean
}

export function HiFiMainShell({
  children,
  inputZone,
  showInput = false,
  withTabBar = true,
  surface = 'default',
  disableEntering = false,
}: HiFiMainShellProps) {
  const entering = usePageEntering()
  const pageClass = [
    'page',
    'active',
    showInput ? 'page--with-input' : withTabBar ? 'page--with-tab' : '',
    !disableEntering && entering ? 'page-entering' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={`hifi-app-root${surface === 'white' ? ' surface-white' : ''}`}>
      <View className='app-shell'>
        <View className='app-safe-top' />
        <View className='page-stack'>
          <View className={pageClass}>{children}</View>
        </View>
        {showInput ? <View className='input-dock'>{inputZone}</View> : null}
      </View>
    </View>
  )
}
