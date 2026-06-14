'use client'
import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { getLatestProfile } from '@/lib/storage/profileStorage'

export default function EvidencePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ReturnType<typeof getLatestProfile>>(null)
  useEffect(() => { setProfile(getLatestProfile()) }, [])
  if (!profile) return (<Msg title="判断依据" msg="还没有画像" router={router} />)

  const items = profile.evidence || []

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="判断依据" showBack onBack={() => router.push('/profile/result')} />

        {items.length > 0 ? (
          <>
            <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 16, lineHeight: 1.55 }}>
              下面这些信息是系统生成画像时的判断依据。每条证据都标注了来源入口和与机制链的关联。
            </div>
            {items.map((e) => (
              <div key={e.id} className="card" style={{
                padding: 18, borderRadius: 22, marginBottom: 12,
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(29,29,31,0.06)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>{e.sourceLabel}</div>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: '#1D1D1F', marginBottom: 6 }}>{e.evidenceText}</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: '#6E6E73' }}>{e.explanation}</div>
              </div>
            ))}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: '#A1A1A6', fontSize: 14 }}>
            当前没有足够证据记录，请先完成入口建模
          </div>
        )}

        <button type="button" className="primary-button"
          onClick={() => router.push('/profile/verify')}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 8 }}>
          看待验证观察点 <ArrowRight size={18} style={{ marginLeft: 6 }} />
        </button>
        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}
function Msg({ title, msg, router }: { title: string; msg: string; router: ReturnType<typeof useRouter> }) {
  return <AppShell><div className="page without-voice with-bottom-tabs">
    <PageHeader title={title} showBack onBack={() => router.push('/profile/result')} />
    <div className="result-card card" style={{ marginTop: 20, textAlign: 'center', padding: 32 }}>
      <div className="result-title">{msg}</div>
    </div></div></AppShell>
}
