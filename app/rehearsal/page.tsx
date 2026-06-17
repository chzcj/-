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
   沟通预演（交付文档 5.2 / 5.3）——单页状态机，接入共用 5.3 切换基座。
   special_collection（采集原话）→ result_view（画像感知预演）⇄ light_followup（继续追问）。
   ================================================================ */

type ChildReaction = { immediateReaction: string; innerReaction: string; behaviorRisk: string }
type AnalyzeData = {
  uiMode?: FeatureUiMode
  profileAware?: boolean
  acknowledgement?: string
  collectionGuide?: string
  // profile-aware 结果
  childLikelyHearing?: string
  possibleChildReaction?: ChildReaction
  riskPoints?: string[]
  saferVersion?: string
  whyThisIsSafer?: string
  avoidPhrases?: string[]
  // 通用结果
  headline?: string
  explanation?: string
  childMayHear?: string[]
  stuckPoint?: string
  suggestedWording?: string
}

// 「你可以这样讲」——对齐 5.2.1，引导家长把原话与意图一起讲。
const GUIDES = [
  '这次你真正想达成什么（让他开始 / 承认卡点 / 修复关系…）',
  '你最担心他怎么反应（顶嘴 / 沉默 / 关门 / 表面答应…）',
  '过去类似的话，通常怎么收场',
  '说之前是不是已经有冲突、疲惫、考试或手机压力',
]

export default function RehearsalPage() {
  const router = useRouter()
  const [mode, setMode] = useState<FeatureUiMode>('special_collection')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AnalyzeData | null>(null)
  const [originalText, setOriginalText] = useState('') // 原话，追问时携带上下文

  async function analyze(parentText: string) {
    if (!parentText.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/rehearsal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentText, fromSpecialFeature: true }),
      })
      const json = await res.json()
      if (json.ok && json.data) {
        const d = json.data as AnalyzeData
        setData(d)
        // 有原话→result_view；空原话→后端回 special_collection 引导
        setMode(d.uiMode === 'special_collection' ? 'special_collection' : 'result_view')
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  // 首次采集：记住原话
  function submitCollection(text: string) {
    setOriginalText(text)
    void analyze(text)
  }

  // 结果后追问：携带原话上下文重新预演
  function submitFollowup(text: string) {
    void analyze(`${originalText}\n\n（家长追问：${text}）`)
  }

  return (
    <AppShell>
      <div className="page">
        <PageHeader title="沟通预演" showBack onBack={() => router.push('/home')} />

        {mode === 'special_collection' ? (
          <SpecialCollectionView
            title="把你准备对孩子说的话，先预演一遍"
            subtitle="先看看这句话到了孩子那里会被听成什么。把原话写进来，不用润色；顺带讲讲下面这些会更准。"
            inputGuides={GUIDES}
            placeholder="把你准备对孩子说的原话直接写进来，比如：你再这样拖下去，手机就别想要了。我其实是想让他今晚把作业开个头，最怕他一听就摔门……"
            primaryActionText="预演一下他会怎么听"
            loadingText="正在结合孩子画像分析这句话…"
            loading={loading}
            extraGuide={data?.collectionGuide || undefined}
            onSubmit={submitCollection}
          />
        ) : null}

        {mode === 'result_view' && data ? (
          <div>
            {originalText ? (
              <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#A1A1A6', marginBottom: 4 }}>你原本想说</div>
                <div style={{ fontSize: 15, lineHeight: 1.5, color: '#1D1D1F', whiteSpace: 'pre-wrap' }}>{originalText.split('\n\n（家长追问：')[0]}</div>
              </div>
            ) : null}

            {data.profileAware ? renderProfileAware(data) : renderGeneric(data)}

            {/* 结果后回到轻追问（5.3.7 轻互动态） */}
            <div style={{ marginTop: 16 }}>
              <LightFollowupView
                acknowledgement=""
                question="想问第一句怎么开口，或这个说法会不会太重？也可以告诉我你试了之后他的反应。"
                loading={loading}
                onSubmit={submitFollowup}
              />
            </div>

            <button type="button" className="secondary-button"
              onClick={() => { setMode('special_collection'); setData(null); setOriginalText('') }}
              style={{ width: '100%', borderRadius: 999, height: 48, fontSize: 15, fontWeight: 600, marginTop: 14 }}>
              <RefreshCw size={16} style={{ marginRight: 6 }} />换一句重新预演
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}

function renderProfileAware(d: AnalyzeData) {
  return (
    <div className="card" style={{ padding: 22, borderRadius: 28, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
      {d.childLikelyHearing ? <Section title="孩子可能先听成">{d.childLikelyHearing}</Section> : null}
      {d.possibleChildReaction ? (
        <Section title="他可能的反应">
          {`当下：${d.possibleChildReaction.immediateReaction}\n心里：${d.possibleChildReaction.innerReaction}\n行为风险：${d.possibleChildReaction.behaviorRisk}`}
        </Section>
      ) : null}
      {d.riskPoints?.length ? <ListSection title="容易踩的点" items={d.riskPoints} /> : null}
      {d.saferVersion ? (
        <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(110,106,248,0.05)', border: '1px solid rgba(110,106,248,0.10)', marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>更建议这样开口</div>
          <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F' }}>{d.saferVersion}</div>
          {d.whyThisIsSafer ? <div style={{ fontSize: 13, lineHeight: 1.55, color: '#6E6E73', marginTop: 8 }}>{d.whyThisIsSafer}</div> : null}
        </div>
      ) : null}
      {d.avoidPhrases?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {d.avoidPhrases.map((p, i) => <span key={i} className="chip" style={{ fontSize: 12, color: '#C0392B', background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.12)' }}>避免：{p}</span>)}
        </div>
      ) : null}
    </div>
  )
}

function renderGeneric(d: AnalyzeData) {
  return (
    <div className="card" style={{ padding: 22, borderRadius: 28, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
      {d.headline ? <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 10, lineHeight: 1.4 }}>{d.headline}</div> : null}
      {d.explanation ? <div style={{ fontSize: 15, lineHeight: 1.6, color: '#6E6E73', marginBottom: 18 }}>{d.explanation}</div> : null}
      {d.childMayHear?.length ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>孩子可能先听成</div>
          {d.childMayHear.map((h, i) => (
            <div key={i} style={{ fontSize: 15, color: '#1D1D1F', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(29,29,31,0.04)' : 'none' }}>{h}</div>
          ))}
        </div>
      ) : null}
      {d.stuckPoint ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>更容易卡住的地方</div>
          <div style={{ fontSize: 15, lineHeight: 1.55, color: '#6E6E73' }}>{d.stuckPoint}</div>
        </div>
      ) : null}
      {d.suggestedWording ? (
        <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(110,106,248,0.05)', border: '1px solid rgba(110,106,248,0.10)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>更建议这样开口</div>
          <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F' }}>{d.suggestedWording}</div>
        </div>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', whiteSpace: 'pre-wrap' }}>{children}</div>
    </div>
  )
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: '#1D1D1F' }}>{it}</li>)}
      </ul>
    </div>
  )
}
