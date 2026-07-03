'use client'

import { useEffect, useState } from 'react'
import { getLatestProfile, hydrateProfileFromRemote } from '@/lib/storage/profileStorage'

/** 二级画像页：优先从 API 拉最新 built snapshot，回退 localStorage。 */
export function useHydratedProfile() {
  const [profile, setProfile] = useState<ReturnType<typeof getLatestProfile>>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const local = getLatestProfile()
    if (local) {
      setProfile(local)
    }

    let cancelled = false
    void fetch('/api/profile/built')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json.ok && json.data?.snapshot?.coreJudgment) {
          hydrateProfileFromRemote(json.data.snapshot)
          setProfile(getLatestProfile())
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { profile, loading }
}
