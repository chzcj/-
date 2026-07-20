import { useCallback, useEffect, useState } from 'react'
import type { HandbookPack } from '@/lib/handbookPack'
import { readLastHandbookPack, readProfileTabCache, writeLastHandbookPack } from '@/lib/profileTabCache'
import { apiRequest } from '@/services/api'

type UseHandbookPackResult = {
  pack: HandbookPack | null
  loading: boolean
  refreshing: boolean
  error: string
  retry: () => void
}

function pickPack(cached: { ok?: boolean; data?: HandbookPack } | null): HandbookPack | null {
  if (cached?.ok && cached.data) return cached.data
  return readLastHandbookPack()
}

export function useHandbookPack(): UseHandbookPackResult {
  const [pack, setPack] = useState<HandbookPack | null>(() => pickPack(readProfileTabCache()?.handbookPack as never))
  const [loading, setLoading] = useState(!pack)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const cached = pickPack(readProfileTabCache()?.handbookPack as never)
    if (cached) {
      setPack(cached)
      setLoading(false)
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')
    try {
      const res = await apiRequest<HandbookPack>('/api/profile/handbook-pack', { method: 'GET' })
      if (res.ok) {
        setPack(res.data)
        writeLastHandbookPack(res.data)
      } else if (!cached) {
        setError(res.error.message || '加载失败，请稍后再试')
      }
    } catch {
      if (!cached) setError('网络异常，请检查连接后重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { pack, loading, refreshing, error, retry: load }
}
