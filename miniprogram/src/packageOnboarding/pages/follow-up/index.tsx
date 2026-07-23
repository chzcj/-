import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BuildRecordBox } from '@/components/profile/BuildRecordBox'
import { FollowUpCard } from '@/components/profile/FollowUpCard'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { getEntryConfig } from '@/data/entryConfig'
import {
  hasSubmittableEntryText,
  MAX_ENTRY_FOLLOW_UP_ROUNDS,
  requestEntryFollowUp,
} from '@/lib/entryAnalyze'
import {
  getEntryProgressPercent,
  mpCapturePath,
  mpSummaryPath,
  normalizeBuildEntryType,
} from '@/lib/buildEntries'
import { mpGoReplace, exitSupplementToProfile, goOnboardingHub } from '@/lib/mpOnboardingNav'
import { resolveFollowUpVoicePrompt } from '@/lib/followUpPrompt'
import {
  appendFollowUpText,
  clearEntryGate,
  getCombinedEntryText,
  getFollowUpCount,
  loadEntryGate,
  saveEntryGate,
  isSupplementFlow,
  type EntryFollowUpGate,
} from '@/services/entryStorage'
import { getEntryCaptureCharHint } from '@/lib/entryCharHint'

const FOLLOW_UP_PLACEHOLDER = '把刚才想到的补充写在这里，或按住说话…'

export default function EntryFollowUpPage() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })
  const router = useRouter()
  const entryType = normalizeBuildEntryType(router.params.entryType || '') || 'daily'
  const config = getEntryConfig(entryType)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [gate, setGate] = useState<EntryFollowUpGate | null>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [round, setRound] = useState(() => Math.max(1, getFollowUpCount(entryType) + 1))
  const loadedRef = useRef(false)

  const applyFollowUp = useCallback((payload: EntryFollowUpGate) => {
    setGate(payload)
    setApiError('')
    setRound(Math.max(1, getFollowUpCount(entryType) + 1))
  }, [entryType])

  const loadFollowUp = useCallback(async (force = false) => {
    if (!force && loadedRef.current) return
    setAiLoading(true)
    setApiError('')

    const combined = getCombinedEntryText(entryType)
    if (!combined) {
      await mpGoReplace(mpCapturePath(entryType))
      return
    }

    const prefetched = loadEntryGate(entryType)
    if (prefetched && prefetched.shouldAsk !== false && !force) {
      applyFollowUp(prefetched)
      setAiLoading(false)
      loadedRef.current = true
      return
    }

    const res = await requestEntryFollowUp(entryType, combined, isSupplementFlow())
    if (!res.ok) {
      setApiError(res.error.message || '追问生成失败，可稍后重试。')
      setAiLoading(false)
      loadedRef.current = true
      return
    }

    if (res.data.shouldAsk === false) {
      clearEntryGate(entryType)
      loadedRef.current = true
      await mpGoReplace(mpSummaryPath(entryType))
      return
    }

    const payload: EntryFollowUpGate = {
      shouldAsk: true,
      purpose: res.data.purpose,
      voicePrompt: res.data.voicePrompt,
      directions: res.data.directions,
    }
    saveEntryGate(entryType, payload)
    applyFollowUp(payload)
    setAiLoading(false)
    loadedRef.current = true
  }, [applyFollowUp, entryType])

  useEffect(() => {
    loadedRef.current = false
    setGate(null)
    setText('')
    setApiError('')
    void loadFollowUp()
  }, [entryType, loadFollowUp])

  const submit = async () => {
    const answer = text.trim()
    if (!hasSubmittableEntryText(answer) || loading || aiLoading) return

    setLoading(true)
    setApiError('')
    Taro.showLoading({ title: '正在判断是否还要追问…', mask: true })

    try {
      appendFollowUpText(entryType, answer)
      const combined = getCombinedEntryText(entryType)
      const nextRound = round + 1
      const canAskMore = round < MAX_ENTRY_FOLLOW_UP_ROUNDS

      if (canAskMore && combined) {
        const res = await requestEntryFollowUp(entryType, combined, isSupplementFlow())
        if (res.ok && res.data.shouldAsk !== false) {
          const payload: EntryFollowUpGate = {
            shouldAsk: true,
            purpose: res.data.purpose,
            voicePrompt: res.data.voicePrompt,
            directions: res.data.directions,
          }
          saveEntryGate(entryType, payload)
          applyFollowUp(payload)
          setRound(nextRound)
          Taro.nextTick(() => setText(''))
          Taro.showToast({ title: '已记录，可继续补充', icon: 'none' })
          return
        }
        if (!res.ok) {
          setApiError(res.error.message || '暂时没判断成功，可以直接整理或重试。')
          return
        }
      }

      clearEntryGate(entryType)
      setGate(null)
      await mpGoReplace(mpSummaryPath(entryType))
    } catch (err) {
      console.error('[follow-up] submit failed', err)
      setApiError('提交时出了点问题，可以重试或直接整理。')
    } finally {
      setLoading(false)
      Taro.hideLoading()
    }
  }

  const skip = async () => {
    if (loading || aiLoading) return
    clearEntryGate(entryType)
    setGate(null)
    await mpGoReplace(mpSummaryPath(entryType))
  }

  const goBackCapture = () => {
    void mpGoReplace(mpCapturePath(entryType))
  }

  const combinedCharHintCount =
    getCombinedEntryText(entryType).trim().length + text.trim().length
  const moduleVolumeHint = getEntryCaptureCharHint(combinedCharHintCount)

  const canSubmit = hasSubmittableEntryText(text) && !loading && !aiLoading
  const roundLabel =
    round > 1 ? `第 ${round} 轮补充` : getFollowUpCount(entryType) > 0 ? '继续补充' : '补充细节'
  const displayPrompt = gate ? resolveFollowUpVoicePrompt(entryType, round) : ''

  return (
    <HiFiBuildShell
      topTitle='补充追问'
      stepLabel={`${config.stepLabel} · 追问`}
      progress={getEntryProgressPercent(entryType, 'follow-up')}
      deepNav={{
        title: '补充追问',
        onBack: () => void mpGoReplace(mpCapturePath(entryType)),
        onExit: isSupplementFlow() ? exitSupplementToProfile : goOnboardingHub,
      }}
      actions={
        aiLoading
          ? []
          : [
              {
                id: 'skip',
                label: '暂不补充，直接整理',
                variant: 'secondary',
                onClick: () => void skip(),
                disabled: loading,
              },
              {
                id: 'submit',
                label: loading ? '系统正在判断…' : '提交这段补充',
                onClick: () => void submit(),
                disabled: !canSubmit,
              },
            ]
      }
    >
      <HiFiBuildHero
        kicker={`${config.stepLabel} · ${roundLabel}`}
        title='补一段刚才没讲到的细节'
        compact
        mascot={false}
      />

      {aiLoading ? (
        <View className='loading-wrap'>
          <View className='loader' />
          <Text className='loading-title'>正在分析你的输入…</Text>
        </View>
      ) : apiError && !gate ? (
        <View className='soft-card'>
          <Text className='soft-card-title'>没生成追问</Text>
          <Text className='soft-card-body'>{apiError}</Text>
          <View className='end-actions' style={{ marginTop: '12px' }}>
            <Text className='chip' onClick={() => void loadFollowUp(true)}>
              重试
            </Text>
            <Text className='chip primary' onClick={() => void skip()}>
              直接整理
            </Text>
          </View>
        </View>
      ) : gate ? (
        <>
          <FollowUpCard voicePrompt={displayPrompt} />
          {moduleVolumeHint ? (
            <Text className='hint-text' style={{ display: 'block', marginTop: '8px' }}>
              {moduleVolumeHint}
            </Text>
          ) : null}
        </>
      ) : null}

      {!aiLoading ? (
        <BuildRecordBox
          label='补充回答'
          status='按住说话约 1 分钟 · 建议 300 字以上'
          value={text}
          placeholder={FOLLOW_UP_PLACEHOLDER}
          disabled={loading}
          metaLeft=''
          showMeta={false}
          showCharHint
          charHintCount={combinedCharHintCount}
          onChange={setText}
        />
      ) : null}

      {!aiLoading && apiError && gate ? (
        <View className='soft-card'>
          <Text className='soft-card-body'>{apiError}</Text>
          <View className='end-actions' style={{ marginTop: '8px' }}>
            <Text className='chip' onClick={() => void submit()}>
              重试提交
            </Text>
            <Text className='chip primary' onClick={() => void skip()}>
              直接整理
            </Text>
          </View>
        </View>
      ) : null}

      {!aiLoading ? (
        <View className='section'>
          <Text className='text-link' onClick={goBackCapture}>
            返回上一页修改
          </Text>
        </View>
      ) : null}
    </HiFiBuildShell>
  )
}
