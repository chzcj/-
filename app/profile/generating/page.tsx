'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import '../build/hifi-build.css'
import { HiFiBuildHero } from '@/components/profile/HiFiBuildHero'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { createProfileSnapshot, hasProfile } from '@/lib/storage/profileStorage'
import { forceAccountSyncToServer } from '@/lib/account/accountSync'
import { canAccessProfileGenerating } from '@/lib/profile/buildGateState'
import { getStorage } from '@/lib/storage/localStorageService'
import { DEFAULT_FAMILY_ID, DEFAULT_CHILD_ID } from '@/lib/storage/storageSeed'
import { humanizeEntryRef, humanizeJoinedEntries, humanizeMechanismLabel } from '@/lib/entry-name-i18n'

export default function GeneratingPage() {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const steps = ['整理四个模块的关键事实', '跨模块综合建模', '生成条件化孩子画像', '整理家庭支持重点']

  useEffect(() => {
    if (hasProfile()) {
      router.replace('/profile/result?onboarding=1')
      return
    }
    if (!canAccessProfileGenerating()) {
      router.replace('/profile/build')
      return
    }
    setAllowed(true)

    let cancelled = false
    const run = async () => {
      setError('')
      setStep(0)
      try {
        const storage = getStorage()
        const entryRecords = storage.entryRecords || []
        const stageSummaries = storage.stageSummaries || []
        const followUpRecords = storage.followUpRecords || []
        const buildSession = storage.buildSessions?.find(s => s.status === 'completed')
          || storage.buildSessions?.[storage.buildSessions.length - 1]

        if (cancelled) return

        setStep(1)

        const LEGACY_MERGE: Record<string, string> = {
          study: 'homework',
          routine: 'daily',
          emotion: 'communication',
          environment: 'family',
        }
        const entryMap: Record<string, { rawTexts: string[]; stageSummary?: string; followUps: string[]; aiFacts?: string[]; aiHypotheses?: string[] }> = {
          daily: { rawTexts: [], followUps: [] },
          homework: { rawTexts: [], followUps: [] },
          communication: { rawTexts: [], followUps: [] },
          family: { rawTexts: [], followUps: [] },
        }

        for (const r of entryRecords) {
          const key = entryMap[r.entryType] ? r.entryType : LEGACY_MERGE[r.entryType]
          const e = key ? entryMap[key] : undefined
          if (e) e.rawTexts.push(r.rawText)
        }
        for (const s of stageSummaries) {
          const key = entryMap[s.entryType] ? s.entryType : LEGACY_MERGE[s.entryType]
          const e = key ? entryMap[key] : undefined
          if (e) {
            e.stageSummary = s.mainJudgment
            e.aiFacts = s.facts
            e.aiHypotheses = s.pendingHypotheses
          }
        }
        for (const f of followUpRecords) {
          const key = entryMap[f.entryType] ? f.entryType : LEGACY_MERGE[f.entryType]
          const e = key ? entryMap[key] : undefined
          if (e && f.userAnswer) e.followUps.push(f.userAnswer)
        }

        const crossCuttingSupplement = followUpRecords
          .filter(f => f.entryType === 'final' && f.userAnswer)
          .map(f => f.userAnswer)
          .join('\n')

        const completedEntries = Object.entries(entryMap).filter(([, v]) => v.rawTexts.length > 0).length

        const synthesisRes = await fetch('/api/synthesis', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryMap,
            crossCuttingSupplement,
            maturityLevel: completedEntries >= 4 ? 'L2' : completedEntries >= 2 ? 'L1' : 'L0',
            familyId: buildSession?.familyId || DEFAULT_FAMILY_ID,
            childId: buildSession?.childId || DEFAULT_CHILD_ID,
          }),
        })
        const synthesisJson = await synthesisRes.json()

        if (cancelled || !synthesisJson.ok) {
          setError('综合建模失败，请返回重建')
          return
        }

        setStep(2)

        const syn = synthesisJson.data?.synthesis || {}

        const evidencePaths: Array<{
          sourceLabel: string
          evidenceText: string
          explanation: string
          strength: 'weak' | 'medium' | 'strong'
        }> = []
        // 用 evidenceText 做去重 key，避免 candidateMechanismMatrix 与 crossEntryEvidenceMap 双源描述同一证据时重复。
        const seenEvidence = new Set<string>()

        for (const cm of syn.candidateMechanismMatrix || []) {
          const evidenceText = humanizeEntryRef((cm.supportingEvidence || []).slice(0, 2).join('；'))
          if (seenEvidence.has(evidenceText)) continue
          seenEvidence.add(evidenceText)
          evidencePaths.push({
            sourceLabel: `候选机制：${humanizeMechanismLabel(cm.mechanismName || '')}`,
            evidenceText,
            explanation: cm.applicableScope || cm.description || '',
            strength: mapStrength(cm.overallStrength),
          })
        }

        for (const ev of syn.crossEntryEvidenceMap || []) {
          const src = (ev.sourceEntries || ['多模块']).join('+')
          const fact = humanizeEntryRef(ev.surfaceBehaviors?.[0] || ev.childReactions?.[0] || '')
          if (seenEvidence.has(fact)) continue
          seenEvidence.add(fact)
          evidencePaths.push({
            sourceLabel: `${humanizeJoinedEntries(src)} · 跨场景`,
            evidenceText: fact,
            explanation: ev.possibleSharedFunction || '',
            strength: mapStrength(ev.evidenceStrength),
          })
        }

        const diagnosisRes = await fetch('/api/diagnosis', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskType: 'profile_build' as const,
            maturityLevel: syn.contextMaturityLevel || 'L2',
            surfaceProblem: syn.candidateMechanismMatrix?.[0]?.mechanismName || '',
            parentSurfaceJudgment: '',
            facts: (syn.candidateMechanismMatrix || []).flatMap((m: { supportingEvidence?: string[] }) => m.supportingEvidence || []),
            childQuotes: [] as string[],
            parentQuotes: [] as string[],
            synthesisOutput: syn,
          }),
        })
        const diagnosisJson = await diagnosisRes.json()

        if (cancelled || !diagnosisJson.ok) {
          setError('深层诊断失败，请返回重建')
          return
        }

        const diag = diagnosisJson.data?.diagnosis || {}

        const profileText = [
          diag.secondMeConditionalProfile?.[0],
          diag.parentMisjudgmentCorrection,
        ].filter(Boolean).join('\n\n') || '暂时无法生成稳定画像，建议补充更多模块信息。'

        const mechanismText = diag.primaryMechanismChain?.parentAction
          ? [
            `家长常见动作：${diag.primaryMechanismChain.parentAction}`,
            `孩子可能接收成：${diag.primaryMechanismChain.childReception}`,
            `孩子保护策略：${diag.primaryMechanismChain.childProtectionStrategy}`,
            `家长二次解读：${diag.primaryMechanismChain.parentSecondInterpretation}`,
            `强化循环：${diag.primaryMechanismChain.reinforcingAction}`,
            `短期功能：${diag.primaryMechanismChain.shortTermFunction}`,
            `长期代价：${diag.primaryMechanismChain.longTermCost}`,
          ]
            .map((line) => humanizeEntryRef(line))
            .join('\n')
          : ''

        const protectionList = diag.childSelfProtection?.protectingWhat || []

        const snapshotInput = {
          completeness: Math.min(completedEntries * 25, 100),
          coreJudgment: profileText,
          deepMechanism: mechanismText,
          supportFocus: protectionList.length > 0
            ? `保护策略：${protectionList.join('、')}；验证点：${(diag.needsFurtherVerification || []).join('；')}`
            : undefined,
          evidence: evidencePaths.length > 0 ? evidencePaths : undefined,
          verificationPoints: (diag.needsFurtherVerification || []).map((v: string) => ({
            title: '待验证',
            description: v,
          })),
        }

        createProfileSnapshot(snapshotInput)
        await forceAccountSyncToServer()

        let persisted = false
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const persistRes = await fetch('/api/profile/built', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ snapshot: snapshotInput }),
            })
            const persistJson = await persistRes.json()
            if (persistRes.ok && persistJson.ok) {
              persisted = true
              break
            }
          } catch {
            /* retry */
          }
          if (attempt < 2) await new Promise((r) => setTimeout(r, 800))
        }
        if (!persisted) {
          if (!cancelled) {
            setError('画像已生成，但未能保存到服务器。请检查网络后点重试。')
          }
          return
        }

        if (cancelled) return

        setStep(3)
        await waitForTripleReady(() => cancelled)

        if (!cancelled) {
          router.push('/profile/result?onboarding=1')
        }
      } catch {
        if (!cancelled) setError('画像生成中断了，可以重试一次。')
      }
    }

    run()
    return () => { cancelled = true }
  }, [router, retryKey])

  if (!allowed) {
    return (
      <HiFiBuildShell topTitle="正在生成孩子画像" stepLabel="建模中" progress={96}>
        <div className="loading-wrap">
          <div className="loader" aria-hidden="true" />
          <h2>正在进入画像生成…</h2>
        </div>
      </HiFiBuildShell>
    )
  }

  return (
    <HiFiBuildShell
      topTitle={error ? '画像没有生成成功' : '正在生成孩子画像'}
      stepLabel="建模中"
      progress={96 + Math.min(step, 3)}
      onBack={error ? () => router.push('/profile/build') : undefined}
      actions={
        error
          ? [
              { label: '重试', onClick: () => setRetryKey((k) => k + 1) },
              { label: '返回采集', variant: 'secondary', onClick: () => router.push('/profile/build') },
            ]
          : []
      }
    >
      <HiFiBuildHero
        kicker="建模中"
        title="正在综合四个模块"
        copy={error ? '可以重试一次，或返回继续补充模块信息。' : '四个模块的信息正在综合，请稍候片刻。'}
        compact
        mascot={!error}
      />

      {!error ? (
        <section className="section">
          <div className="soft-card">
            <div className="flow-steps" aria-label="生成进度">
              {steps.map((label, i) => (
                <div key={label}>
                  <div className={`flow-step${i < step ? ' done' : ''}${i === step ? ' active' : ''}`}>{label}</div>
                  {i < steps.length - 1 ? <div className="flow-arrow">↓</div> : null}
                </div>
              ))}
            </div>
          </div>
          <p className="hint-text" style={{ marginTop: 12 }}>
            正在调用 AI 生成中，通常需要 30～60 秒
          </p>
        </section>
      ) : (
        <section className="section">
          <div className="soft-card">
            <p>{error}</p>
          </div>
        </section>
      )}
    </HiFiBuildShell>
  )
}

function mapStrength(s: string | undefined): 'weak' | 'medium' | 'strong' {
  if (s === 'weak') return 'weak'
  if (s === 'strong') return 'strong'
  return 'medium'
}

async function waitForTripleReady(isCancelled: () => boolean): Promise<void> {
  const MAX_TRIES = 16
  const INTERVAL = 2500
  for (let i = 0; i < MAX_TRIES; i++) {
    if (isCancelled()) return
    try {
      const r = await fetch('/api/profile/readiness')
      const json = await r.json()
      if (json.ok && json.data?.ready) return
    } catch {
      /* ignore */
    }
    if (isCancelled()) return
    await new Promise<void>((resolve) => setTimeout(resolve, INTERVAL))
  }
}
