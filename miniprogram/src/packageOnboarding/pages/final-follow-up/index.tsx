import { Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { BuildRecordBox } from '@/components/profile/BuildRecordBox'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { allModulesCompleted } from '@/services/entryStorage'
import { loadBuildState, saveBuildState } from '@/services/buildState'
import { apiRequest } from '@/services/api'
import { ensureProfileBuildInFlight } from '@/services/profilePipeline'

export default function FinalFollowUpPage() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })
  const [text, setText] = useState(loadBuildState().finalFollowUpText || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!allModulesCompleted()) {
      Taro.showToast({ title: '请先完成四个模块', icon: 'none' })
      await mpGoReplace('/packageOnboarding/pages/hub/index')
      return
    }
    const value = text.trim()
    setLoading(true)
    setError('')
    Taro.showLoading({ title: '提交中…', mask: true })

    const state = loadBuildState()
    state.finalFollowUpText = value
    state.finalFollowUpSubmitted = true
    saveBuildState(state)

    const res = await apiRequest('/api/entry/analyze', {
      method: 'POST',
      data: { entryType: 'final', rawText: value, stage: 'entry' },
    })

    Taro.hideLoading()
    setLoading(false)

    if (!res.ok) {
      setError(res.error.message || '提交失败，请稍后再试')
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' })
      return
    }

    // 首版 synthesis → diagnosis 沿用原流水线，先在基础资料页期间预热。
    void ensureProfileBuildInFlight()
    await mpGoReplace('/packageOnboarding/pages/basic/index')
  }

  return (
    <HiFiBuildShell
      topTitle='最后补充'
      stepLabel='补充信息'
      progress={92}
      actions={[
        {
          id: 'submit',
          label: loading ? '提交中…' : '提交全部信息',
          onClick: () => void submit(),
          disabled: loading,
        },
      ]}
    >
      <HiFiBuildHero title='还有什么想让孩子被看见的？' copy='有就补充；前面已经说完也可以直接提交。' />
      <BuildRecordBox
        label='最后补充'
        status='按住说话或直接输入'
        value={text}
        disabled={loading}
        placeholder='例如：其实他并不是不努力，而是…'
        showCharHint={false}
        showMeta={false}
        metaLeft=''
        onChange={setText}
      />
      {error ? <Text className='hifi-voice-error'>{error}</Text> : null}
    </HiFiBuildShell>
  )
}
