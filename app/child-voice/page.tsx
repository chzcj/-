'use client'
import { Camera, Eye, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { VoiceFieldButton, appendTranscript } from '@/components/voice/VoiceFieldButton'

export default function ChildVoicePage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)

  function handleSubmit() {
    if (!text.trim()) return
    // 孩子原话不再丢弃：暂存给多视角页（即时用），多视角 API 会写回记忆（child_quote）。
    try { sessionStorage.setItem('childos_child_voice', text.trim()) } catch {}
    setSaved(true)
    setTimeout(() => router.push('/multi-view'), 800)
  }

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="今天想说一点什么" showBack onBack={() => router.push('/home')} />

        <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>
          不用想对不对，讲讲今天最烦、最累，或者最想躲开的一件事
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, marginTop: 14 }}>
          {['今天最烦', '最想躲开的事', '最想让大人懂'].map((c) => (
            <span key={c} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{c}</span>
          ))}
        </div>

        <textarea value={text} onChange={(e) => { setText(e.target.value); setSaved(false) }}
          placeholder="今天回家后我其实不想马上写作业，因为一想到后面还有好多东西，我就会烦..."
          style={{ width: '100%', minHeight: 140, borderRadius: 20, border: '1px solid rgba(29,29,31,0.08)', background: 'rgba(255,255,255,0.72)', padding: 14, fontSize: 15, lineHeight: 1.55, color: '#1D1D1F', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />

        <VoiceFieldButton idleLabel="说一说，自动转文字" onTranscript={(t) => { setText((prev) => appendTranscript(prev, t)); setSaved(false) }} style={{ marginTop: 10 }} />

        <div style={{ fontSize: 13, color: '#A1A1A6', marginTop: 6, marginBottom: 20 }}>
          这里只有记录，没有批评
        </div>

        {saved ? (
          <div className="card" style={{ padding: 16, borderRadius: 22, marginBottom: 20, textAlign: 'center', background: 'rgba(157,204,117,0.04)', border: '1px solid rgba(157,204,117,0.10)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#4f9f72' }}>已保存。正在打开多视角校正...</div>
          </div>
        ) : (
          <button type="button" className="primary-button" onClick={handleSubmit} disabled={!text.trim()}
            style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}>
            提交这一段
          </button>
        )}

        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}
