import { View, Text } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthorityInsightCard } from '@/components/hifi/AuthorityInsightCard'
import { StructuralTensionCard } from '@/components/hifi/StructuralTensionCard'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { getEntryConfig } from '@/data/entryConfig'
import { requestEntrySummary } from '@/lib/entryAnalyze'
import type { StructuralTension } from '@/lib/portraitCard'
import { apiRequest } from '@/services/api'
import {
  getEntryProgressPercent,
  getNextBuildEntry,
  mpCapturePath,
  mpFollowUpPath,
  normalizeBuildEntryType,
  type BuildEntryType,
} from '@/lib/buildEntries'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import {
  confirmModuleComplete,
  getCombinedEntryText,
  getLatestStageSummary,
  saveStageSummary,
  type StageSummaryData,
} from '@/services/entryStorage'

function isInsufficientSummary(mainJudgment: string, facts: string[]) {
  if (!facts.length) return true
  return /信息不足|不足以还原|还不够|暂时无法|需要更多/.test(mainJudgment)
}

export default function EntrySummaryPage() {
  const router = useRouter()
  const entryType = normalizeBuildEntryType(router.params.entryType || '') || 'daily'
  const config = getEntryConfig(entryType)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<StageSummaryData | null>(null)
  const [error, setError] = useState('')
  const [structuralTensions, setStructuralTensions] = useState<StructuralTension[]>([])

  const loadSummary = useCallback(
    async (force = false) => {
      const combined = getCombinedEntryText(entryType)
      if (!combined) {
        await mpGoReplace(mpCapturePath(entryType))
        return
      }

      setError('')
      if (!force) {
        const cached = getLatestStageSummary(entryType)
        if (cached?.mainJudgment) {
          setSummary(cached)
          setLoading(false)
          return
        }
      }

      setLoading(true)
      setSummary(null)
      const res = await requestEntrySummary(entryType, combined)
      setLoading(false)
      if (!res.ok) {
        setError(res.error.message || '这一步暂时没有整理成功，可以稍后再试。')
        return
      }
      const data: StageSummaryData = {
        mainJudgment: res.data.mainJudgment || '',
        facts: res.data.facts || [],
        pendingHypotheses: res.data.pendingHypotheses || [],
      }
      saveStageSummary(entryType, data)
      setSummary(data)
    },
    [entryType]
  )

  useEffect(() => {
    void loadSummary()
    void apiRequest<{ structuralTensions?: StructuralTension[] }>('/api/profile/hub', {
      method: 'GET',
    }).then((res) => {
      if (res.ok && Array.isArray(res.data.structuralTensions)) {
        setStructuralTensions(res.data.structuralTensions)
      }
    })
  }, [loadSummary])

  const nextEntry = getNextBuildEntry(entryType)
  const isLast = nextEntry === 'final-follow-up'
  const insufficient = useMemo(
    () => (summary ? isInsufficientSummary(summary.mainJudgment, summary.facts) : false),
    [summary]
  )

  const goNext = () => {
    if (!nextEntry) return
    if (nextEntry === 'final-follow-up') {
      void mpGoReplace('/packageOnboarding/pages/final-follow-up/index')
      return
    }
    void mpGoReplace(mpCapturePath(nextEntry as BuildEntryType))
  }

  const handleConfirm = () => {
    if (!summary) return
    confirmModuleComplete(entryType)
    goNext()
  }

  const errorActions = [
    {
      id: 'retry',
      label: '重试整理',
      onClick: () => void loadSummary(true),
    },
    {
      id: 'edit',
      label: '返回补充',
      variant: 'secondary' as const,
      onClick: () => void mpGoReplace(mpFollowUpPath(entryType)),
    },
    {
      id: 'recapture',
      label: '重新填写本模块',
      variant: 'quiet' as const,
      onClick: () => void mpGoReplace(mpCapturePath(entryType)),
    },
  ]

  const successActions = [
    {
      id: 'next',
      label: isLast ? '整理得对，进入收尾追问' : '先继续下一模块',
      onClick: handleConfirm,
    },
    {
      id: 'edit',
      label: '返回补充',
      variant: 'secondary' as const,
      onClick: () => void mpGoReplace(mpFollowUpPath(entryType)),
    },
    {
      id: 'recapture',
      label: '重新填写本模块',
      variant: 'quiet' as const,
      onClick: () => void mpGoReplace(mpCapturePath(entryType)),
    },
  ]

  const actions = loading ? [] : summary ? successActions : error ? errorActions : []

  return (
    <HiFiBuildShell
      topTitle={config.summaryTitle}
      stepLabel={`${config.stepLabel} · 整理`}
      progress={getEntryProgressPercent(entryType, 'summary')}
      actions={actions}
    >
      <HiFiBuildHero
        kicker={`${config.stepLabel} 已整理`}
        title={config.summaryTitle}
        copy='先确认系统抓到的背景是否贴近真实情况。信息不够也可以先继续，后面还能补。'
        compact
        mascot={false}
      />

      {loading ? (
        <View className='loading-wrap'>
          <View className='loader' />
          <Text className='loading-title'>正在整理本模块…</Text>
        </View>
      ) : null}

      {!loading && error && !summary ? (
        <View className='soft-card'>
          <Text className='soft-card-title'>这一步没有整理成功</Text>
          <Text className='soft-card-body'>{error}</Text>
          <Text className='hint-text'>可以重试，或返回补充/重新填写本模块。</Text>
        </View>
      ) : null}

      {summary && insufficient ? (
        <View className='insufficient-banner'>
          <Text className='insufficient-banner-title'>当前信息还不够完整</Text>
          <Text className='insufficient-banner-copy'>
            可以点「返回补充」再讲一段具体场景；也可以点「先继续下一模块」，不会卡在这一步。
          </Text>
        </View>
      ) : null}

      {summary ? (
        <>
          <AuthorityInsightCard title='系统整理' body={summary.mainJudgment}>
            {summary.facts.length ? (
              <View className='summary-facts'>
                {summary.facts.map((f) => (
                  <Text key={f} className='summary-fact-item'>
                    · {f}
                  </Text>
                ))}
              </View>
            ) : null}
            {summary.pendingHypotheses.length ? (
              <View className='summary-hypotheses'>
                {summary.pendingHypotheses.map((h) => (
                  <Text key={h} className='chip'>
                    {h}
                  </Text>
                ))}
              </View>
            ) : null}
          </AuthorityInsightCard>

          {structuralTensions.length ? (
            <StructuralTensionCard tensions={structuralTensions} compact />
          ) : null}

          <View className='soft-card' style={{ marginTop: '12px' }}>
            <Text className='soft-card-title'>请确认一下</Text>
            <Text className='soft-card-body'>{config.confirm}</Text>
          </View>
        </>
      ) : null}
    </HiFiBuildShell>
  )
}
