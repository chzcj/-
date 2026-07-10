import { View, Text, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { allModulesCompleted } from '@/services/entryStorage'
import { loadBuildState, saveBuildState } from '@/services/buildState'
import { apiRequest } from '@/services/api'

export default function FinalFollowUpPage() {
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
    if (value.length < 20) {
      Taro.showToast({ title: '请再补充一些（至少 20 字）', icon: 'none' })
      return
    }
    setLoading(true)
    setError('')
    Taro.showLoading({ title: '提交中…', mask: true })

    const state = loadBuildState()
    state.finalFollowUpText = value
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

    await mpGoReplace('/packageOnboarding/pages/generating/index')
  }

  return (
    <HiFiBuildShell
      topTitle='最后一次补充'
      stepLabel='收尾追问'
      progress={92}
      actions={[
        {
          id: 'submit',
          label: loading ? '提交中…' : '开始生成画像',
          onClick: () => void submit(),
          disabled: loading,
        },
      ]}
    >
      <HiFiBuildHero
        title='还有什么想让孩子被看见的？'
        copy='不用面面俱到，讲一个你觉得最重要、但前面可能还没讲透的片段。'
      />
      <View className='record-box'>
        <Textarea
          className='record-area'
          value={text}
          disabled={loading}
          placeholder='例如：其实他并不是不努力，而是…'
          onInput={(e) => setText(e.detail.value)}
        />
      </View>
      {error ? <Text className='hifi-voice-error'>{error}</Text> : null}
    </HiFiBuildShell>
  )
}
