import Taro, { useDidShow } from '@tarojs/taro'
import type { CustomTabBarHandle } from '@/custom-tab-bar/index'

export type TabKey = 'chat' | 'tasks' | 'rehearsal' | 'profile'

const TAB_INDEX: Record<TabKey, number> = {
  chat: 0,
  tasks: 1,
  rehearsal: 2,
  profile: 3,
}

function getTabBar(): CustomTabBarHandle | null {
  const page = Taro.getCurrentInstance().page
  return Taro.getTabBar<CustomTabBarHandle>(page) || null
}

export function useTabBar(active: TabKey) {
  useDidShow(() => {
    getTabBar()?.setSelected(TAB_INDEX[active])
    getTabBar()?.setVisible(true)
  })
}

/** 对话/结束：隐藏整槽。勿在 entry 初次进入时 showTabBar（会拉出原生文字栏）。 */
export function hideRehearsalTabBar() {
  getTabBar()?.setVisible(false)
  void Taro.hideTabBar({ animation: false }).catch(() => undefined)
}

/** 从对话页返回 entry/confirm 时再 show。 */
export function showRehearsalTabBar() {
  getTabBar()?.setVisible(true)
  void Taro.showTabBar({ animation: false }).catch(() => undefined)
}
