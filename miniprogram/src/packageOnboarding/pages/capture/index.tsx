import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { CaptureDirective } from '@/components/onboarding/CaptureDirective'
import { BuildRecordBox } from '@/components/profile/BuildRecordBox'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
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

      <CaptureDirective entryType={entryType} />

      <BuildRecordBox
        label='真实情况记录'
        status='按住说话约 1 分钟 · 建议 300 字以上'
        value={draft}
        placeholder={config.placeholder}
        disabled={loading}
        metaLeft=''
        showMeta={false}
        showCharHint
        onChange={setDraft}
      />

      {apiError ? (
        <View className='soft-card'>
          <Text className='soft-card-title'>提交没有成功</Text>
          <Text className='soft-card-body'>{apiError}</Text>
          <Text className='hint-text'>可以修改内容后重试，或先保存文字稍后再提交。</Text>
        </View>
      ) : null}
    </HiFiBuildShell>
  )
}
