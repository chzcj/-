'use client'

import { Suspense } from 'react'
import { BuildFlowGuard } from '@/components/profile/BuildFlowGuard'
import './hifi-build.css'

export default function ProfileBuildLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="hifi-build-root profile-build-loading">加载中…</div>}>
      <BuildFlowGuard>{children}</BuildFlowGuard>
    </Suspense>
  )
}
