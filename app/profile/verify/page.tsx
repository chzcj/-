'use client'
import { ArrowRight, Camera, Eye, MessageCircle, Mic } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { getLatestProfile } from '@/lib/storage/profileStorage'

export default function VerifyPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ReturnType<typeof getLatestProfile>>(null)
  useEffect(() => { setProfile(getLatestProfile()) }, [])
  if (!profile) {
    return (<AppShell><div className="page without-voice with-bottom-tabs">
      <PageHeader title="待验证观察点" showBack onBack={() => router.push('/profile/result')} />
      <div className="result-card card" style={{ marginTop: 20, textAlign: 'center', padding: 32 }}>
        <div className="result-title">还没有画像</div></div></div></AppShell>)
  }
  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="后面再观察什么" showBack onBack={() => router.push('/profile/result')} />
        <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 16 }}>
          画像已经够用了，但下面几件事再看清一点，会让后面的判断更准
        </div>
        {profile.verificationPoints?.map((v) => (
          <div key={v.id} className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 12, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(29,29,31,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>{v.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: '#6E6E73' }}>{v.description}</div>
          </div>
        ))}
        <div style={{ fontSize: 13, color: '#A1A1A6', textAlign: 'center', marginBottom: 14, marginTop: 8 }}>
          这些不是要你立刻改变做法，只是后面多留意
        </div>
        <button type="button" className="primary-button"
          onClick={() => router.push('/rehearsal')}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}>
          进入沟通预演 <ArrowRight size={18} style={{ marginLeft: 6 }} />
        </button>
        <NavTabs />
      </div>
    </AppShell>
  )
}
function NavTabs() {
  const router = useRouter()
  return <BottomNavTabs active="profile" />
}
