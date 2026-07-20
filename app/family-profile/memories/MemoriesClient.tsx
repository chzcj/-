'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ProfileSubPage } from '../_components/ProfileSubPage'
import type { HandbookPack, MemoryFeedItem } from '@/types/handbook-pack'

const FEED_LABEL: Record<string, string> = {
  voice: '冲突语音',
  diary: '随笔',
  shine: '闪光时刻',
  hard: '家庭难题',
}

function formatAxis(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { day: value, mon: '' }
  return { day: `${date.getDate()}日`, mon: `${date.getMonth() + 1}月` }
}

function feedTitle(item: MemoryFeedItem) {
  return item.displayLine || item.title || item.keyword
}

export function MemoriesClient() {
  const searchParams = useSearchParams()
  const scope = searchParams.get('scope') === 'recent' ? 'recent' : 'all'
  const isRecent = scope === 'recent'

  const [pack, setPack] = useState<HandbookPack | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const packRef = useRef<HandbookPack | null>(null)
  packRef.current = pack

  const items = isRecent ? pack?.memoryFeedRecent || [] : pack?.memoryFeed || []
  const rangeLabel = pack?.handbook?.weekRangeLabel

  const fetchPack = useCallback(async () => {
    const cached = packRef.current
    if (cached) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')
    try {
      const res = await fetch('/api/profile/handbook-pack', { credentials: 'include' }).then((r) =>
        r.json()
      )
      if (res.ok) {
        setPack(res.data as HandbookPack)
      } else if (!cached) {
        setError(res.error?.message || '加载失败')
      }
    } catch {
      if (!cached) setError('网络异常')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchPack()
  }, [fetchPack])

  return (
    <ProfileSubPage title={isRecent ? '近7天记忆' : '手账记忆'}>
      {refreshing ? <p className="hint-text">更新中…</p> : null}
      {loading && !items.length ? <p className="hint-text">正在整理…</p> : null}
      {error && !items.length ? (
        <p className="hint-text">
          {error}{' '}
          <button type="button" className="link-button" onClick={() => void fetchPack()}>
            重试
          </button>
        </p>
      ) : null}
      {!loading && !items.length && !error ? (
        <div className="handbook-empty-web">
          <div className="handbook-empty-art" aria-hidden>
            <div className="handbook-empty-sheet s1" />
            <div className="handbook-empty-sheet s2" />
            <div className="handbook-empty-sheet s3" />
          </div>
          <p className="sheet-lead">手账记的是值得回看的瞬间，不是所有聊天记录</p>
          <Link href="/daily" className="sheet-cta">
            去日常交流
          </Link>
        </div>
      ) : null}
      {items.length > 0 ? (
        <p className="sheet-lead">
          {isRecent
            ? `${rangeLabel || '近7天'} · 共 ${items.length} 条`
            : `共 ${items.length} 条 · 按时间倒序`}
        </p>
      ) : null}
      {items.map((item) => {
        const axis = formatAxis(item.occurredAt)
        return (
          <article key={item.id} className="mem-row-web">
            <div style={{ textAlign: 'center' }}>
              <div className="sheet-kicker" style={{ marginBottom: 2 }}>
                {axis.day}
              </div>
              <div style={{ fontSize: 10, color: '#868b94' }}>{axis.mon}</div>
            </div>
            <a href={`/family-profile/memory/${encodeURIComponent(item.id)}`} className="mem-card-web">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 14 }}>{feedTitle(item)}</strong>
                <span className="sheet-kicker" style={{ flexShrink: 0 }}>
                  {FEED_LABEL[item.type] || item.type}
                </span>
              </div>
              {(item.teaser || item.snippet) && (
                <p className="mini-card-body">{item.teaser || item.snippet}</p>
              )}
            </a>
          </article>
        )
      })}
    </ProfileSubPage>
  )
}
