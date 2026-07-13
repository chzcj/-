import { forwardRef, useImperativeHandle, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { fetchCurrentUser } from '@/services/auth'
import { ChatIcon, ProfileIcon, RehearsalIcon, TasksIcon } from '@/components/hifi/icons/TabIcons'
import './index.scss'

export type TabKey = 'chat' | 'tasks' | 'rehearsal' | 'profile'

export type CustomTabBarHandle = {
  setSelected: (index: number) => void
}

const TABS: { key: TabKey; label: string; url: string; Icon: typeof ChatIcon }[] = [
  { key: 'chat', label: '交流', url: '/pages/daily/index', Icon: ChatIcon },
  { key: 'tasks', label: '任务', url: '/pages/tasks/index', Icon: TasksIcon },
  { key: 'rehearsal', label: '预演', url: '/pages/rehearsal/index', Icon: RehearsalIcon },
  { key: 'profile', label: '画像', url: '/pages/profile/index', Icon: ProfileIcon },
]

const CustomTabBar = forwardRef<CustomTabBarHandle>((_, ref) => {
  const [selected, setSelected] = useState(0)

  useImperativeHandle(ref, () => ({
    setSelected: (index: number) => setSelected(index),
  }))

  const switchTab = async (index: number, url: string) => {
    if (index === selected) return
    const user = await fetchCurrentUser()
    if (user && !user.onboardingComplete) {
      void Taro.reLaunch({ url: '/packageOnboarding/pages/hub/index' })
      return
    }
    setSelected(index)
    await Taro.switchTab({ url })
  }

  return (
    <View className='bottom-tabs-wrap'>
      <View className='bottom-tabs'>
        {TABS.map((tab, index) => {
          const active = selected === index
          const Icon = tab.Icon
          return (
            <View
              key={tab.key}
              className={`tab-button${active ? ' active' : ''}`}
              onClick={() => void switchTab(index, tab.url)}
            >
              <Icon active={active} />
              <Text className='tab-label'>{tab.label}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
})

CustomTabBar.displayName = 'CustomTabBar'

export default CustomTabBar
