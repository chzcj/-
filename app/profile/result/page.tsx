'use client'
import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { getLatestProfile } from '@/lib/storage/profileStorage'

export default function ProfileResultPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ReturnType<typeof getLatestProfile>>(null)
  useEffect(() => { setProfile(getLatestProfile()) }, [])
  if (!profile) {
    return (
      <AppShell><div className="page without-voice with-bottom-tabs">
        <PageHeader title="孩子画像" showBack onBack={() => router.push('/profile/build')} />
        <div className="result-card card" style={{ marginTop: 20, textAlign: 'center', padding: 32 }}>
          <div className="result-title">还没有孩子画像</div>
          <div style={{ fontSize: 15, color: '#6E6E73', marginTop: 10 }}>请先完成五入口建模</div>
          <button type="button" className="primary-button" onClick={() => router.push('/profile/build')}
            style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 20 }}>建立孩子画像</button>
        </div>
      </div></AppShell>
    )
  }

  const hasEvidence = (profile.evidence || []).length > 0

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="孩子画像" showBack onBack={() => router.push('/home')} />
        <div
          style={{
            fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6,
            background: 'linear-gradient(135deg, rgba(110,106,248,0.06), rgba(110,106,248,0.02))',
            borderRadius: 12, padding: '8px 14px', display: 'inline-block'
          }}>
          画像完整度 {profile.completeness}%
        </div>

        <div style={{
          marginTop: 16, marginBottom: 16,
          padding: '20px 18px', borderRadius: 22,
          background: 'rgba(255,255,255,0.72)',
          border: '1px solid rgba(29,29,31,0.06)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6E6AF8', marginBottom: 10 }}>
            条件化画像
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: '#1D1D1F', whiteSpace: 'pre-wrap' }}>
            {profile.coreJudgment}
          </div>
        </div>

        {profile.supportFocus ? (
          <div style={{ padding: '14px 16px', borderRadius: 20, background: 'rgba(110,106,248,0.05)', border: '1px solid rgba(110,106,248,0.10)', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>当前支持重点</div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: '#6E6E73' }}>{profile.supportFocus}</div>
          </div>
        ) : null}

        {hasEvidence ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {profile.evidence?.slice(0, 4).map((e) => (
              <span key={e.id} className="chip" style={{ fontSize: 12, cursor: 'default' }}>{e.sourceLabel}</span>
            ))}
          </div>
        ) : null}

        <button type="button" className="primary-button"
          onClick={() => router.push('/profile/deep')}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
          去看机制链解释 <ArrowRight size={18} style={{ marginLeft: 6 }} />
        </button>
        <button type="button" className="secondary-button"
          onClick={() => router.push('/rehearsal')}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}>
          进入沟通预演
        </button>
        <NavTabs />
      </div>
    </AppShell>
  )
}
function NavTabs() {
  return (
    <BottomNavTabs active="profile" />
  )
}
