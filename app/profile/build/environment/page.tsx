'use client'
import { Camera, Eye, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar'
import { getEntryConfig } from '@/data/entryConfig'
import { createEntryRecord } from '@/lib/storage/entryStorage'
import type { InputMode } from '@/types/childos'

export default function EnvironmentInputPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const config = getEntryConfig('environment')
  async function handleSubmit(text: string, _mode: InputMode) {
    if (!text.trim() || loading) return
    setLoading(true)
    createEntryRecord({ entryType: 'environment', rawText: text.trim() })
    setLoading(false)
    router.push('/profile/build/environment/follow-up')
  }
  return (
    <AppShell>
      <div className="page capture-page with-capture-dock">
        <PageHeader title={`${config.title} ${config.stepLabel}`} showBack onBack={() => router.push('/profile/build')} />
        <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>{config.prompt}</div>
        <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14, lineHeight: 1.5 }}>{config.helper}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {config.chips.map((c) => <span key={c} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{c}</span>)}
        </div>
        <BottomNavTabs active="profile" />
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint={config.prompt} disabled={loading} elevated onSubmit={handleSubmit} />
    </AppShell>
  )
}
