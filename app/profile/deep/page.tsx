'use client'
import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { getLatestProfile } from '@/lib/storage/profileStorage'

export default function DeepPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ReturnType<typeof getLatestProfile>>(null)
  useEffect(() => { setProfile(getLatestProfile()) }, [])

  if (!profile) {
    return (<AppShell><div className="page without-voice with-bottom-tabs">
      <PageHeader title="深层解释" showBack onBack={() => router.push('/profile/result')} />
      <div className="result-card card" style={{ marginTop: 20, textAlign: 'center', padding: 32 }}>
        <div className="result-title">还没有画像</div>
        <button type="button" className="primary-button" onClick={() => router.push('/profile/build')}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 20 }}>建立孩子画像</button>
      </div>
    </div></AppShell>)
  }

  const mechanismText = profile.deepMechanism || ''

  return (
    <AppShell>
      <div className="page without-voice with-bottom-tabs">
        <PageHeader title="深层解释" showBack onBack={() => router.push('/profile/result')} />

        <div style={{
          marginBottom: 16,
          padding: '16px 18px', borderRadius: 20,
          background: 'rgba(110,106,248,0.04)',
          border: '1px solid rgba(110,106,248,0.08)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>
            家庭机制链
          </div>
          <div style={{ fontSize: 14, color: '#6E6E73', lineHeight: 1.55 }}>
            下面展示的不是普通总结，而是孩子在这个家庭里的应对链条——家长的动作触发孩子的保护策略，孩子的反应又触发家长进一步解读。
          </div>
        </div>

        {mechanismText ? (
          <div style={{
            padding: '20px 18px', borderRadius: 22,
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(29,29,31,0.06)',
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 15, lineHeight: 1.75, color: '#1D1D1F', whiteSpace: 'pre-wrap' }}>
              {mechanismText}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: '#A1A1A6', fontSize: 14 }}>
            当前信息不足以构建完整机制链，建议补充更多入口信息
          </div>
        )}

        <button type="button" className="primary-button"
          onClick={() => router.push('/profile/evidence')}
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600 }}>
          继续看判断依据 <ArrowRight size={18} style={{ marginLeft: 6 }} />
        </button>
        <BottomNavTabs active="profile" />
      </div>
    </AppShell>
  )
}
