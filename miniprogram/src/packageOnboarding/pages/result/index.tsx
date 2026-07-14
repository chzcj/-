import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { apiRequest } from '@/services/api'
import { goToDailyTab } from '@/utils/navigation'
import { fetchCurrentUser } from '@/services/auth'
import { isBasicInfoComplete } from '@/services/childStorage'
import { hydrateProfileFromRemote, type LocalProfileSnapshot } from '@/services/profileStorage'

type ProfileSnapshot = LocalProfileSnapshot

export default function OnboardingResult() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })
  const [loading, setLoading] = useState(true)
  const [entering, setEntering] = useState(false)
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    void loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    setLoadError('')
    const built = await apiRequest<{
      snapshot?: ProfileSnapshot
      onboardingComplete?: boolean
    }>('/api/profile/built', { method: 'GET' })

    if (built.ok && built.data.snapshot?.coreJudgment) {
      hydrateProfileFromRemote(built.data.snapshot)
      setSnapshot(built.data.snapshot)
      setOnboardingComplete(Boolean(built.data.onboardingComplete))
      setLoading(false)
      return
    }

    const hub = await apiRequest<{ completeness?: number }>('/api/profile/hub', { method: 'GET' })
    if (hub.ok && typeof hub.data.completeness === 'number') {
      setSnapshot({ coreJudgment: '', completeness: hub.data.completeness })
    }

    if (!built.ok) {
      setLoadError(built.error.message || '画像加载失败')
    } else if (!built.data.snapshot?.coreJudgment) {
      setLoadError('还没有孩子画像，请先完成四个模块建模')
    }
    setLoading(false)
  }

  const enterApp = async () => {
    setEntering(true)
    const user = await fetchCurrentUser()
    setEntering(false)
    if (user?.onboardingComplete || onboardingComplete) {
      goToDailyTab()
      return
    }
    if (!isBasicInfoComplete()) {
      void mpGoReplace('/packageOnboarding/pages/basic/index')
      return
    }
    Taro.showToast({ title: '还差一步，请填写孩子信息', icon: 'none' })
    void mpGoReplace('/packageOnboarding/pages/basic/index')
  }

  const goHub = () => void mpGoReplace('/packageOnboarding/pages/hub/index')

  if (loading) {
    return (
      <HiFiBuildShell topTitle='画像已就绪' stepLabel='完成' progress={100}>
        <View className='loading-wrap'>
          <View className='loader' />
          <Text className='loading-title'>正在加载孩子画像…</Text>
        </View>
      </HiFiBuildShell>
    )
  }

  if (loadError || !snapshot?.coreJudgment) {
    return (
      <HiFiBuildShell
        topTitle='孩子画像'
        stepLabel='完成'
        progress={100}
        actions={[
          { id: 'hub', label: '返回四模块采集', onClick: goHub },
          { id: 'retry', label: '重新加载', variant: 'secondary', onClick: () => void loadProfile() },
        ]}
      >
        <View className='soft-card'>
          <Text className='soft-card-title'>还没有孩子画像</Text>
          <Text className='soft-card-body'>{loadError || '请先完成四个模块建模'}</Text>
        </View>
      </HiFiBuildShell>
    )
  }

  const completeness = snapshot.completeness

  return (
    <HiFiBuildShell
      topTitle='画像已就绪'
      stepLabel='完成'
      progress={100}
      actions={[
        {
          id: 'enter',
          label: entering ? '进入中…' : '开始交流',
          onClick: () => void enterApp(),
          disabled: entering,
        },
      ]}
    >
      <HiFiBuildHero
        kicker='画像已生成'
        title='可以开始交流和预演了'
        copy='下面的理解会作为后续对话的背景。'
        compact
        mascot={false}
      />

      {typeof completeness === 'number' ? (
        <View className='soft-card' style={{ marginBottom: '12px' }}>
          <Text className='section-label'>画像完整度</Text>
          <Text className='soft-card-body'>{completeness}%</Text>
        </View>
      ) : null}

      <View className='summary-card'>
        <Text className='section-label'>核心理解</Text>
        <Text className='summary-lead'>{snapshot.coreJudgment}</Text>
      </View>

      {snapshot.supportFocus ? (
        <View className='summary-card' style={{ marginTop: '12px' }}>
          <Text className='section-label'>当前支持重点</Text>
          <Text className='soft-card-body'>{snapshot.supportFocus}</Text>
        </View>
      ) : null}

      <View className='end-actions' style={{ marginTop: '16px' }}>
        <Text
          className='pill'
          onClick={() => void Taro.navigateTo({ url: '/pages/profile/evidence/index' })}
        >
          判断依据
        </Text>
        <Text
          className='pill'
          onClick={() => void Taro.navigateTo({ url: '/pages/profile/verify/index' })}
        >
          待验证观察点
        </Text>
        <Text
          className='pill'
          onClick={() => void Taro.navigateTo({ url: '/pages/profile/deep/index' })}
        >
          机制链解释
        </Text>
      </View>
    </HiFiBuildShell>
  )
}
