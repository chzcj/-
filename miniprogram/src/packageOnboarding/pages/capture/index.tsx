import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { BuildRecordBox } from '@/components/profile/BuildRecordBox'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { getEntryConfig } from '@/data/entryConfig'
import {
  getEntryProgressPercent,
  mpFollowUpPath,
  mpSummaryPath,
  normalizeBuildEntryType,
} from '@/lib/buildEntries'
import { mpGoReplace, exitSupplementToProfile, goOnboardingHub } from '@/lib/mpOnboardingNav'
import { apiRequest, getSessionToken } from '@/services/api'
import { getCombinedEntryText, saveCaptureText, saveEntryGate, appendSupplementText, getExistingEntryPreview, isSupplementFlow } from '@/services/entryStorage'

export default function EntryCapturePage() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })
  const router = useRouter()
  const entryType = normalizeBuildEntryType(router.params.entryType || '') || 'daily'
  const supplementMode = router.params.mode === 'supplement' || isSupplementFlow()
  const config = getEntryConfig(entryType)
  const [draft, setDraft] = useState('')
  const [showExisting, setShowExisting] = useState(false)
  const existingPreview = supplementMode ? getExistingEntryPreview(entryType) : ''
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [promptIndex, setPromptIndex] = useState(0)

  useEffect(() => {
    if (!getSessionToken()) {
      void goOnboardingHub()
      return
    }
    if (!supplementMode) {
      const existing = getCombinedEntryText(entryType)
      if (existing) setDraft(existing)
    }
  }, [entryType, supplementMode])

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
    if (supplementMode) {
      appendSupplementText(entryType, merged)
    } else {
      saveCaptureText(entryType, merged)
    }
    const combined = getCombinedEntryText(entryType)
    const res = await apiRequest<{
      shouldAsk?: boolean
      purpose?: string
      voicePrompt?: string
      directions?: string[]
    }>('/api/entry/analyze', {
      method: 'POST',
      data: { entryType, rawText: combined, stage: 'entry', appendMode: supplementMode },
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
      deepNav={{
        title: supplementMode ? `补充${config.title}` : config.title,
        onBack: goOnboardingHub,
        onExit: supplementMode ? exitSupplementToProfile : goOnboardingHub,
      }}
      actions={[
        {
          id: 'submit',
          label: loading ? '正在确认信息…' : '提交',
          onClick: () => void handleContinue(),
          disabled: loading || !hasText,
        },
      ]}
    >
      <HiFiBuildHero
        kicker={supplementMode ? `${config.stepLabel} 补充信息` : `${config.stepLabel} 专项采集`}
        title={supplementMode ? `补充${config.title}` : config.title}
        copy={
          supplementMode
            ? '再补一段真实场景即可，不会覆盖已有记录。'
            : config.subtitle
        }
        compact
        mascot={false}
      />

      {supplementMode && existingPreview ? (
        <View className='soft-card supplement-existing'>
          <Text className='section-label' onClick={() => setShowExisting((v) => !v)}>
            {showExisting ? '收起已采集内容' : '查看已采集内容'}
          </Text>
          {showExisting ? (
            <Text className='soft-card-body supplement-existing-body'>{existingPreview}</Text>
          ) : null}
        </View>
      ) : null}

      <View className='soft-card'>
        <Text className='soft-card-body'>{config.body}</Text>
        <View className='hint-block'>
          <Text>{config.defaultHint}</Text>
        </View>
      </View>

      <BuildRecordBox
        label='真实情况记录'
        status='按住说话 1–2 分钟'
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

      {currentPrompt ? (
        <View className='prompt-switch-wrap'>
          <View className='prompt-switch-btn' onClick={() => setPromptIndex((i) => i + 1)}>
            <Text className='prompt-switch-btn-text'>换一个问题</Text>
          </View>
        </View>
      ) : null}
    </HiFiBuildShell>
  )
}
