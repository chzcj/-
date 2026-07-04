'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { BottomNavTabs } from '@/components/layout/BottomNavTabs'
import { PageHeader } from '@/components/ui/PageHeader'
import { isOnboardingComplete } from '@/lib/profile/onboarding'

type ProfileBuildShellProps = {
  stepLabel?: string
  title: string
  kicker?: string
  prompt?: string
  helper?: string
  backHref: string
  children: ReactNode
  footer?: ReactNode
  withBottomTabs?: boolean
  withVoiceDock?: boolean
}

export function ProfileBuildFrame({
  stepLabel,
  title,
  kicker = '建立孩子画像',
  prompt,
  helper,
  backHref,
  children,
  withBottomTabs = true,
  withVoiceDock = false,
}: ProfileBuildShellProps) {
  const router = useRouter()
  const headerTitle = stepLabel ? `${title} ${stepLabel}` : title
  const onboarding = !isOnboardingComplete()
  const showTabs = withBottomTabs && !onboarding

  return (
    <div className={`page profile-build-page${withVoiceDock ? ' with-capture-dock' : ''}${showTabs ? ' with-bottom-tabs' : ''}`}>
      <PageHeader title={headerTitle} showBack onBack={() => router.push(backHref)} />
      <section className="profile-build-hero">
        <div className="profile-build-kicker">{kicker}</div>
        {prompt ? <h2 className="profile-build-prompt">{prompt}</h2> : null}
        {helper ? <p className="profile-build-helper">{helper}</p> : null}
      </section>
      {children}
      {showTabs ? <BottomNavTabs active="profile" /> : null}
    </div>
  )
}

export function ProfileBuildShell(props: ProfileBuildShellProps) {
  return (
    <AppShell>
      <ProfileBuildFrame {...props} />
    </AppShell>
  )
}
