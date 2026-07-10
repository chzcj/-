import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { BuildRecordBox } from '@/components/profile/BuildRecordBox'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { getEntryConfig } from '@/data/entryConfig'
import {
  getEntryProgressPercent,
  mpFollowUpPath,
  mpSummaryPath,
  normalizeBuildEntryType,
} from '@/lib/buildEntries'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { apiRequest } from '@/services/api'
import { getCombinedEntryText, saveCaptureText, saveEntryGate } from '@/services/entryStorage'

export default function EntryCapturePage() {
  const router = useRouter()
  const entryType = normalizeBuildEntryType(router.params.entryType || '') || 'daily'
  const config = getEntryConfig(entryType)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [promptIndex, setPromptIndex] = useState(0)

  useEffect(() => {
    const existing = getCombinedEntryText(entryType)
    if (existing) setDraft(existing)
  }, [entryType])

  const currentPrompt = useMemo(
    () => config.prompts[promptIndex % config.prompts.length] || config.prompts[0],
    [config, promptIndex]
  )
  const hasText = draft.trim().length >= 2

  const handleContinue = async () => {
    const merged = draft.trim()
    if (!merged || merged.length < 2) {
      Taro.showToast({ title: '先写几个字或说几句原话就可以提交', icon: 'none' })
      return
    }
    setLoading(true)
    setApiError('')
    saveCaptureText(entryType, merged)
    const res = await apiRequest<{
      shouldAsk?: boolean
      purpose?: string
      voicePrompt?: string
      directions?: string[]
    }>('/api/entry/analyze', {
      method: 'POST',
      data: { entryType, rawText: merged, stage: 'entry' },
    })
    setLoading(false)
    if (!res.ok) {
      setApiError(res.error.message || '提交失败，可以稍后再试。')
      return
    }
    if (res.data.shouldAsk === false) {
      await mpGoReplace(mpSummaryPath(entryType))
      return
    }
    saveEntryGate(entryType, {
      shouldAsk: true,
      purpose: res.data.purpose,
      voicePrompt: res.data.voicePrompt,
      directions: res.data.directions,
    })
    await mpGoReplace(mpFollowUpPath(entryType))
  }

  return (
    <HiFiBuildShell
      topTitle={config.title}
      stepLabel={`${config.stepLabel} 专项采集`}
      progress={getEntryProgressPercent(entryType, 'input')}
      actions={[
        {
          id: 'submit',
          label: loading ? '系统正在看信息够不够…' : '提交，让系统看看',
          onClick: () => void handleContinue(),
          disabled: loading || !hasText,
        },
      ]}
    >
      <HiFiBuildHero
        kicker={`${config.stepLabel} 专项采集`}
        title={config.title}
        copy={`${config.subtitle} 讲得越多我们对孩子越了解，清北教育专家会耐心听您讲完。`}
        compact
      />

      <View className='soft-card'>
        <Text className='soft-card-body'>{config.body}</Text>
        <View className='hint-block'>
          <Text>{config.defaultHint}</Text>
        </View>
      </View>

      <BuildRecordBox
        label='真实情况记录'
        status='请您尽量按住说话 1–2 分钟'
        value={draft}
        placeholder={config.placeholder}
        disabled={loading}
        prompt={currentPrompt}
        onChange={setDraft}
      />

      {apiError ? (
        <View className='soft-card'>
          <Text className='soft-card-title'>提交没有成功</Text>
          <Text className='soft-card-body'>{apiError}</Text>
          <Text className='hint-text'>可以修改内容后重试，或先保存文字稍后再提交。</Text>
        </View>
      ) : null}

      <View className='section'>
        <Text className='section-label'>可以顺着这些方向讲</Text>
        <View className='chips'>
          {config.chips.map((chip) => (
            <Text
              key={chip}
              className='chip'
              onClick={() => setDraft((prev) => (prev ? `${prev}\n${chip}：` : `${chip}：`))}
            >
              {chip}
            </Text>
          ))}
        </View>
        <Text className='hint-text' onClick={() => setPromptIndex((i) => i + 1)}>
          换一个问题
        </Text>
      </View>
    </HiFiBuildShell>
  )
}
