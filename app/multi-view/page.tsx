'use client'
import { Camera, Eye, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { mockMultiViewCorrection } from '@/data/mockOutputs'

export default function MultiViewPage() {
  const router = useRouter()
  const m = mockMultiViewCorrection

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="多视角校正" showBack onBack={() => router.push('/profile/result')} />

        <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>综合整理</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 12, lineHeight: 1.4 }}>{m.headline}</div>
        <div style={{ fontSize: 15, lineHeight: 1.62, color: '#6E6E73', marginBottom: 20 }}>{m.summary}</div>

        <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 10, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>家长这边</div>
          <div style={{ fontSize: 15, color: '#1D1D1F' }}>{m.parentView}</div>
        </div>

        <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 10, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>孩子自己说</div>
          <div style={{ fontSize: 15, color: '#1D1D1F' }}>{m.childView}</div>
        </div>

        <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 14, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>老师观察</div>
          <div style={{ fontSize: 15, color: '#1D1D1F' }}>{m.teacherView}</div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {m.finalChips.map((c) => <span key={c} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{c}</span>)}
        </div>

        <button type="button" className="primary-button"
          onClick={() => router.push('/profile/result')}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}>
          回到孩子档案
        </button>

        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}
