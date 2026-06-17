'use client'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { SpecialCollectionView } from '@/components/special/SpecialCollectionView'
import { LightFollowupView } from '@/components/special/LightFollowupView'
import type { FeatureUiMode } from '@/types/feature-ui'

/* ================================================================
   家庭综合规划（交付文档 5.4 / 5.3）——单页状态机，接入共用 5.3 切换基座。
   special_collection（采集承受力）→ result_view（少量动作）⇄ light_followup（失败节点/动作落地）。
   ================================================================ */

type FamilyPlanAction = { title: string; detail: string }
type FamilyPlan = {
  acknowledgement: string
  boundaryFirst: string
  actions: FamilyPlanAction[]
  missingInfo: string
  note: string
  enoughToPlan?: boolean
}
type PlannerData = { uiMode?: FeatureUiMode; plan: FamilyPlan }

// 场景化自述提示卡（交付文档 5.4.1）：用提示卡而非必填表单，让家长自由讲。
const HINTS = [
  '孩子当前最主要的卡点（学习 / 手机 / 情绪 / 作息）',
  '你最希望先改善的是什么',
  '你每天大概能投入多少时间精力盯',
  '家里的资源边界（谁能执行、补课 / 经济）',
  '以前类似的安排为什么没坚持下来',
]

export default function FamilyPlannerPage() {
  const router = useRouter()
  const [mode, setMode] = useState<FeatureUiMode>('special_collection')
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<FamilyPlan | null>(null)
  const [originalText, setOriginalText] = useState('')

  async function request(text: string) {
    if (!text.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/family-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (json.ok && json.data?.plan) {
        const d = json.data as PlannerData
        setPlan(d.plan)
        setMode(d.uiMode === 'light_followup' ? 'light_followup' : 'result_view')
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  function submitCollection(text: string) {
    setOriginalText(text)
    void request(text)
  }

  // 失败节点追问 / 结果后微调：携带原述上下文重提交
  function submitFollowup(text: string) {
    void request(`${originalText}\n\n（补充：${text}）`)
  }

  return (
    <AppShell>
      <div className="page">
        <PageHeader title="家庭规划" showBack onBack={() => router.push('/home')} />

        {mode === 'special_collection' ? (
          <SpecialCollectionView
            title="这里不是生成密密麻麻的时间表"
            subtitle="而是看这个家庭真实能承受什么。你可以从下面这些方向随便讲，不用都讲完整。"
            inputGuides={HINTS}
            placeholder="像讲生活片段一样多说一点，比如：孩子初二，每天放学先玩手机，作业拖到很晚，我们俩工作都忙，之前定过计划但坚持不到一周……"
            primaryActionText="看看可以先做什么"
            loadingText="正在按家庭承受力梳理…"
            loading={loading}
            onSubmit={submitCollection}
          />
        ) : null}

        {mode === 'light_followup' && plan ? (
          <LightFollowupView
            acknowledgement={plan.acknowledgement}
            question={plan.missingInfo || '之前类似的安排，是卡在哪一步没坚持下来的？（孩子抗拒 / 你没时间盯 / 冲突变多 / 定太多做不完）'}
            loading={loading}
            onSubmit={submitFollowup}
          />
        ) : null}

        {mode === 'result_view' && plan ? (
          <div>
            <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 16, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', marginBottom: 14 }}>{plan.acknowledgement}</div>

              {plan.boundaryFirst ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>先稳一个边界</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: '#1D1D1F', marginBottom: 14 }}>{plan.boundaryFirst}</div>
                </>
              ) : null}

              {plan.actions.length > 0 ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>接下来可以先做（{plan.actions.length} 件）</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    {plan.actions.map((a, i) => (
                      <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 12, border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 4 }}>{a.title}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: '#6E6E73' }}>{a.detail}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {plan.note ? <div style={{ fontSize: 13, color: '#6E6E73' }}>{plan.note}</div> : null}
            </div>

            {/* 结果后回到轻追问（5.3.9 轻互动态） */}
            <LightFollowupView
              acknowledgement=""
              question="想问某个动作具体怎么落地，或这个动作放在周几更合适？"
              loading={loading}
              onSubmit={submitFollowup}
            />

            <button type="button" className="secondary-button"
              onClick={() => { setMode('special_collection'); setPlan(null); setOriginalText('') }}
              style={{ width: '100%', borderRadius: 999, height: 48, fontSize: 15, fontWeight: 600, marginTop: 14 }}>
              <RefreshCw size={16} style={{ marginRight: 6 }} />重新讲讲家里的情况
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
