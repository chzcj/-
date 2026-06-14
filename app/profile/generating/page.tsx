'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { createProfileSnapshot } from '@/lib/storage/profileStorage'
import { getStorage } from '@/lib/storage/localStorageService'
import { DEFAULT_FAMILY_ID, DEFAULT_CHILD_ID } from '@/lib/storage/storageSeed'

export default function GeneratingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const steps = ['整理五个入口的关键事实', '跨入口综合建模', '生成条件化孩子画像']

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const storage = getStorage()
        const entryRecords = storage.entryRecords || []
        const stageSummaries = storage.stageSummaries || []
        const followUpRecords = storage.followUpRecords || []
        const buildSession = storage.buildSessions?.find(s => s.status === 'completed')
          || storage.buildSessions?.[storage.buildSessions.length - 1]

        if (cancelled) return

        setStep(1)

        const entryMap: Record<string, { rawTexts: string[], stageSummary?: string, followUps: string[] }> = {
          study: { rawTexts: [], followUps: [] },
          routine: { rawTexts: [], followUps: [] },
          communication: { rawTexts: [], followUps: [] },
          emotion: { rawTexts: [], followUps: [] },
          environment: { rawTexts: [], followUps: [] },
        }

        for (const r of entryRecords) {
          const e = entryMap[r.entryType]
          if (e) e.rawTexts.push(r.rawText)
        }
        for (const s of stageSummaries) {
          const e = entryMap[s.entryType]
          if (e) e.stageSummary = s.mainJudgment
        }
        for (const f of followUpRecords) {
          const e = entryMap[f.entryType]
          if (e && f.userAnswer) e.followUps.push(f.userAnswer)
        }

        const completedEntries = Object.entries(entryMap).filter(([, v]) => v.rawTexts.length > 0).length

        const synthesisRes = await fetch('/api/synthesis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryMap,
            maturityLevel: completedEntries >= 5 ? 'L2' : completedEntries >= 3 ? 'L1' : 'L0',
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

        for (const cm of syn.candidateMechanismMatrix || []) {
          evidencePaths.push({
            sourceLabel: `候选机制：${cm.mechanismName || ''}`,
            evidenceText: (cm.supportingEvidence || []).slice(0, 2).join('；'),
            explanation: cm.applicableScope || cm.description || '',
            strength: mapStrength(cm.overallStrength),
          })
        }

        for (const ev of syn.crossEntryEvidenceMap || []) {
          const src = (ev.sourceEntries || ['多入口']).join('+')
          const fact = ev.surfaceBehaviors?.[0] || ev.childReactions?.[0] || ''
          evidencePaths.push({
            sourceLabel: `${src} · 跨场景`,
            evidenceText: fact,
            explanation: ev.possibleSharedFunction || '',
            strength: mapStrength(ev.evidenceStrength),
          })
        }

        const diagnosisRes = await fetch('/api/diagnosis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskType: 'profile_build' as const,
            maturityLevel: syn.contextMaturityLevel || 'L2',
            surfaceProblem: syn.candidateMechanismMatrix?.[0]?.mechanismName || '',
            parentSurfaceJudgment: '',
            facts: (syn.candidateMechanismMatrix || []).flatMap((m: any) => m.supportingEvidence || []),
            childQuotes: [] as string[],
            parentQuotes: [] as string[],
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
        ].filter(Boolean).join('\n\n') || '暂时无法生成稳定画像，建议补充更多入口信息。'

        const mechanismText = diag.primaryMechanismChain?.parentAction
          ? [
            `家长常见动作：${diag.primaryMechanismChain.parentAction}`,
            `孩子可能接收成：${diag.primaryMechanismChain.childReception}`,
            `孩子保护策略：${diag.primaryMechanismChain.childProtectionStrategy}`,
            `家长二次解读：${diag.primaryMechanismChain.parentSecondInterpretation}`,
            `强化循环：${diag.primaryMechanismChain.reinforcingAction}`,
            `短期功能：${diag.primaryMechanismChain.shortTermFunction}`,
            `长期代价：${diag.primaryMechanismChain.longTermCost}`,
          ].join('\n')
          : ''

        const protectionList = diag.childSelfProtection?.protectingWhat || []

        createProfileSnapshot({
          completeness: Math.min(completedEntries * 20, 100),
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
        })

        if (!cancelled) {
          router.push('/profile/result')
        }
      } catch (_err) {
        if (!cancelled) {
          setStep(2)
          setTimeout(() => router.push('/profile/result'), 500)
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [router])

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="画像生成中" showBack={false} />
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div className="loader" style={{ width: 56, height: 56, borderWidth: 5 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1D1D1F' }}>正在生成孩子画像</div>
          {steps.map((s, i) => (
            <div key={i} style={{ fontSize: 14, color: i <= step ? '#6E6AF8' : '#C7C7CC', fontWeight: i === step ? 600 : 400, transition: 'color 300ms' }}>
              {s}
            </div>
          ))}
          {error ? (
            <div style={{ fontSize: 14, color: '#FF3B30', marginTop: 10 }}>{error}</div>
          ) : (
            <div style={{ fontSize: 13, color: '#A1A1A6', marginTop: 10 }}>正在调用 AI 生成中，请稍候</div>
          )}
        </div>
        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}

function mapStrength(s: string | undefined): 'weak' | 'medium' | 'strong' {
  if (s === 'weak') return 'weak'
  if (s === 'strong') return 'strong'
  return 'medium'
}
