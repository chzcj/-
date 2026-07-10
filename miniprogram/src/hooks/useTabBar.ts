import Taro, { useDidShow } from '@tarojs/taro'
import type { CustomTabBarHandle } from '@/custom-tab-bar/index'

export type TabKey = 'chat' | 'tasks' | 'rehearsal' | 'profile'

const TAB_INDEX: Record<TabKey, number> = {
  chat: 0,
  tasks: 1,
  rehearsal: 2,
  profile: 3,
}

export function useTabBar(active: TabKey) {
  useDidShow(() => {
    const page = Taro.getCurrentInstance().page
    const tabBar = Taro.getTabBar<CustomTabBarHandle>(page)
    tabBar?.setSelected(TAB_INDEX[active])
  })
}
