'use client'
import { ArrowRight, Camera, Eye, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type CSSProperties } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar'
import { hasProfile } from '@/lib/storage/profileStorage'
import type { InputMode } from '@/types/childos'

export default function RehearsalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [goal, setGoal] = useState('')
  const [worry, setWorry] = useState('')
  const [bg, setBg] = useState('')

  function handleSubmit(text: string, _mode: InputMode) {
    if (!text.trim() || loading) return
    setLoading(true)
    const q = new URLSearchParams({ text: text.trim() })
    if (goal.trim()) q.set('goal', goal.trim())
    if (worry.trim()) q.set('worry', worry.trim())
    if (bg.trim()) q.set('bg', bg.trim())
    setTimeout(() => { setLoading(false); router.push('/rehearsal/result?' + q.toString()) }, 300)
  }

  const profileReady = hasProfile()
  const fieldStyle: CSSProperties = {
    width: '100%', fontSize: 14, lineHeight: 1.5, padding: '9px 12px', borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.10)', boxSizing: 'border-box', background: '#fff'
  }

  return (
    <AppShell>
      <div className="page capture-page with-capture-dock">
        <PageHeader title="沟通预演" showBack onBack={() => router.push('/home')} />
        {profileReady ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>
              把您现在最想对孩子说的话，直接写进来
            </div>
            <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14 }}>不用润色，按您平时会说的话来</div>
          </>
        ) : (
          <div className="card" style={{ padding: 20, borderRadius: 22, marginBottom: 14, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
            <div style={{ fontSize: 16, fontWeight: 650, color: '#1D1D1F', marginBottom: 8 }}>还没建立孩子画像</div>
            <div style={{ fontSize: 14, color: '#6E6E73', lineHeight: 1.5, marginBottom: 14 }}>
              在画像未建立前，预演会用通用模式分析您的沟通方式。
              为了获得更准确、更贴合您家孩子的分析，建议先花几分钟建立画像。
            </div>
            <button type="button" className="secondary-button"
              onClick={() => router.push('/profile/build')}
              style={{ width: '100%', borderRadius: 999, height: 48, fontSize: 15, fontWeight: 600 }}>
              先去建立孩子画像
              <ArrowRight size={16} style={{ marginLeft: 6 }} />
            </button>
          </div>
        )}

        {/* 选填：多讲一点，预演会更贴近真实（交付文档 5.2.1）。这些字段一起发给后端做画像感知预演。 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#A1A1A6' }}>下面这些选填，多讲一点预演更准：</div>
          <input style={fieldStyle} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="这次你真正想达成什么（让他开始/承认卡点/修复关系…）" />
          <input style={fieldStyle} value={worry} onChange={(e) => setWorry(e.target.value)} placeholder="你最担心他怎么反应（顶嘴/沉默/关门/表面答应…）" />
          <input style={fieldStyle} value={bg} onChange={(e) => setBg(e.target.value)} placeholder="说之前是不是已经有冲突/疲惫/考试/手机压力" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {['催作业', '聊成绩', '说手机'].map((c) => <span key={c} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{c}</span>)}
        </div>
        <BottomNavTabs active="rehearsal" />
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint="把你准备对孩子说的话发来" disabled={loading} elevated onSubmit={handleSubmit} />
    </AppShell>
  )
}
