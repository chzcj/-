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
  const [retryKey, setRetryKey] = useState(0)
  const steps = ['整理五个入口的关键事实', '跨入口综合建模', '生成条件化孩子画像', '生成家庭简报与支持看板']

  useEffect(() => {
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

        // final-follow-up 的综合补充答案：作为 crossCuttingSupplement 纳入综合（不属五入口之一）。
        const crossCuttingSupplement = followUpRecords
          .filter(f => f.entryType === 'final' && f.userAnswer)
          .map(f => f.userAnswer)
          .join('\n')

        const completedEntries = Object.entries(entryMap).filter(([, v]) => v.rawTexts.length > 0).length

        const synthesisRes = await fetch('/api/synthesis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entryMap,
            crossCuttingSupplement,
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
            // 把综合输出整包交给诊断：机制矩阵/跨入口证据/handoff 都靠它，否则诊断结构字段会空。
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

        const snapshotInput = {
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
        }

        createProfileSnapshot(snapshotInput)

        // 持久化到 DB（让画像跨设备/重装不丢）：改 await（best-effort）确保快照确实落库再继续，失败不致命。
        await fetch('/api/profile/built', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot: snapshotInput }),
        }).catch(() => {})

        if (cancelled) return

        // 强保证三件套 v1（交付文档 3.4/13.4）：跳 result 前等 FamilyModel v1 + Brief v1 + Board v1 就绪。
        // generating 本是 loading 页（不违背前台快）。synthesis/diagnosis 的 memory_write 已链式触发
        // digest_update→rebuildBriefAndBoard，这里只轮询等它跑完；超时仍跳转（result 靠本地快照、board/daily 优雅处理 pending，不死锁）。
        setStep(3)
        await waitForTripleReady(() => cancelled)

        if (!cancelled) {
          router.push('/profile/result')
        }
      } catch (_err) {
        // 不再静默跳结果页（会展示旧画像/空态）；明确报错 + 提供重试入口。
        if (!cancelled) setError('画像生成中断了，可以重试一次。')
      }
    }

    run()
    return () => { cancelled = true }
  }, [router, retryKey])

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="画像生成中" showBack={false} />
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {!error ? <div className="loader" style={{ width: 56, height: 56, borderWidth: 5 }} /> : null}
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1D1D1F' }}>{error ? '画像没有生成成功' : '正在生成孩子画像'}</div>
          {!error ? steps.map((s, i) => (
            <div key={i} style={{ fontSize: 14, color: i <= step ? '#6E6AF8' : '#C7C7CC', fontWeight: i === step ? 600 : 400, transition: 'color 300ms' }}>
              {s}
            </div>
          )) : null}
          {error ? (
            <>
              <div style={{ fontSize: 14, color: '#FF3B30', marginTop: 6, textAlign: 'center' }}>{error}</div>
              <button type="button" className="primary-button" onClick={() => setRetryKey(k => k + 1)}
                style={{ borderRadius: 999, height: 48, padding: '0 28px', fontSize: 15, fontWeight: 600 }}>重试</button>
              <button type="button" className="secondary-button" onClick={() => router.push('/profile/build')}
                style={{ borderRadius: 999, height: 44, padding: '0 24px', fontSize: 14, fontWeight: 600 }}>返回建模</button>
            </>
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

// 轮询三件套 v1 就绪（交付文档 3.4/13.4）：ready 即返回；最多 ~16s（8×2s）后超时返回（兜底，不死锁）。
// isCancelled 让页面卸载/重试时提前退出。
async function waitForTripleReady(isCancelled: () => boolean): Promise<void> {
  const MAX_TRIES = 8
  const INTERVAL = 2000
  for (let i = 0; i < MAX_TRIES; i++) {
    if (isCancelled()) return
    try {
      const r = await fetch('/api/profile/readiness')
      const json = await r.json()
      if (json.ok && json.data?.ready) return
    } catch {
      /* 网络抖动忽略，继续轮询直到超时兜底 */
    }
    if (isCancelled()) return
    await new Promise<void>(resolve => setTimeout(resolve, INTERVAL))
  }
  // 达上限仍未就绪：照常返回，让调用方跳转（result 靠本地快照、board/daily 优雅处理 pending）。
}
