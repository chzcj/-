'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'

type FamilyPlanAction = { title: string; detail: string }
type FamilyPlan = {
  acknowledgement: string
  boundaryFirst: string
  actions: FamilyPlanAction[]
  missingInfo: string
  note: string
}

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
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<FamilyPlan | null>(null)

  async function submit() {
    const value = text.trim()
    if (!value || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/family-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value }),
      })
      const json = await res.json()
      if (json.ok && json.data?.plan) setPlan(json.data.plan)
    } catch {} finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="page">
        <PageHeader title="家庭规划" showBack onBack={() => router.push('/home')} />

        <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>
          这里不是生成密密麻麻的时间表
        </div>
        <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14, lineHeight: 1.55 }}>
          而是看这个家庭真实能承受什么。你可以从下面这些方向随便讲，不用都讲完整。
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {HINTS.map((h) => (
            <div
              key={h}
              style={{ fontSize: 13, color: '#6E6AF8', background: 'rgba(110,106,248,0.05)', border: '1px solid rgba(110,106,248,0.10)', borderRadius: 12, padding: '8px 12px' }}
            >
              {h}
            </div>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="像讲生活片段一样多说一点，比如：孩子初二，每天放学先玩手机，作业拖到很晚，我们俩工作都忙，之前定过计划但坚持不到一周……"
          disabled={loading}
          style={{ width: '100%', minHeight: 140, fontSize: 15, lineHeight: 1.6, padding: 14, borderRadius: 16, border: '1px solid rgba(0,0,0,0.10)', resize: 'vertical', boxSizing: 'border-box' }}
        />

        <button
          type="button"
          disabled={loading || !text.trim()}
          onClick={submit}
          style={{ width: '100%', marginTop: 12, padding: '13px 0', fontSize: 15, fontWeight: 600, color: '#fff', background: loading || !text.trim() ? '#B8B6F5' : '#6E6AF8', border: 'none', borderRadius: 14, cursor: loading || !text.trim() ? 'default' : 'pointer' }}
        >
          {loading ? '正在按家庭承受力梳理…' : '看看可以先做什么'}
        </button>

        {plan ? (
          <div className="card" style={{ padding: 18, borderRadius: 22, marginTop: 18, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
            <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', marginBottom: 14 }}>{plan.acknowledgement}</div>

            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>先稳一个边界</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: '#1D1D1F', marginBottom: 14 }}>{plan.boundaryFirst}</div>

            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>接下来可以先做（{plan.actions.length} 件）</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: plan.missingInfo ? 14 : 4 }}>
              {plan.actions.map((a, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 12, border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 4 }}>{a.title}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: '#6E6E73' }}>{a.detail}</div>
                </div>
              ))}
            </div>

            {plan.missingInfo ? (
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#8A6D00', background: 'rgba(255,200,0,0.08)', borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>{plan.missingInfo}</div>
            ) : null}

            <div style={{ fontSize: 13, color: '#6E6E73' }}>{plan.note}</div>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
