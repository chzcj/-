'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import '../portrait-revamp.css'

type Props = {
  title: string
  children: ReactNode
  className?: string
}

export function ProfileSubPage({ title, children, className }: Props) {
  const router = useRouter()

  return (
    <OnboardingGuard>
      <HiFiMainShell activeTab="profile" surface="white">
        <div className={`profile-sub-page${className ? ` ${className}` : ''}`}>
          <button type="button" className="profile-sub-back" onClick={() => router.back()}>
            ← 返回
          </button>
          <h2 className="section-title">{title}</h2>
          {children}
        </div>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}
