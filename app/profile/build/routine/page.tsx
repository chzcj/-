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
import type { EntryType } from '@/types/storage'

export default function RoutineInputPage() {
  return (
    <EntryInputPage
      entryType="routine"
      nextRoute="/profile/build/routine/follow-up"
      backRoute="/profile/build"
    />
  )
}

function EntryInputPage({
  entryType,
  nextRoute,
  backRoute,
}: {
  entryType: EntryType
  nextRoute: string
  backRoute: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const config = getEntryConfig(entryType)

  async function handleSubmit(text: string, _mode: InputMode) {
    if (!text.trim() || loading) return
    setLoading(true)
    createEntryRecord({ entryType, rawText: text.trim() })
    setLoading(false)
    router.push(nextRoute)
  }

  return (
    <AppShell>
      <div className="page capture-page with-capture-dock">
        <PageHeader title={`${config.title} ${config.stepLabel}`} showBack onBack={() => router.push(backRoute)} />

        <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>
          {config.prompt}
        </div>
        <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14, lineHeight: 1.5 }}>
          {config.helper}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {config.chips.map((c) => (
            <span key={c} className="chip" style={{ fontSize: 13, cursor: 'default' }}>{c}</span>
          ))}
        </div>

        <NavTabs active={entryType === 'study' ? 'home' : 'home'} router={router} />
      </div>
      <BottomVoiceBar state={loading ? 'transcribing' : 'idle'} hint={config.prompt} disabled={loading} elevated onSubmit={handleSubmit} />
    </AppShell>
  )
}

function NavTabs({ active, router }: { active: string; router: ReturnType<typeof useRouter> }) {
  return (
    <BottomNavTabs active="profile" />
  )
}
