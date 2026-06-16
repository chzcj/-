'use client'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { BottomVoiceBar } from '@/components/voice/BottomVoiceBar'
import type { InputMode } from '@/types/childos'

type Turn = { role: 'parent' | 'ai'; text: string }

/* ================================================================
   新版日常对话 —— 主入口（合并深度复盘，交付文档 4）。
   家长每轮输入经 /api/daily/stream 流式回复；越聊越懂靠后台记忆而非会话缓冲。
   ================================================================ */
function DailyDialogueContent() {
  const router = useRouter()
  const [turns, setTurns] = useState<Turn[]>([])
  const [streaming, setStreaming] = useState('')
  const [loading, setLoading] = useState(false)
  const startedRef = useRef(false)
  const threadEndRef = useRef<HTMLDivElement>(null)

  // 一轮对话：追加家长消息 → 流式拿 AI 回复。
  async function runTurn(text: string) {
    const value = text.trim()
    if (!value || loading) return
    setTurns((prev) => [...prev, { role: 'parent', text: value }])
    setLoading(true)
    setStreaming('')
    try {
      const res = await fetch('/api/daily/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value }),
      })
      let acc = ''
      if (res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value: chunk } = await reader.read()
          if (done) break
          buffer += decoder.decode(chunk, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const evt = JSON.parse(line)
              if (evt.type === 'delta') { acc += evt.delta; setStreaming(acc) }
              else if (evt.type === 'final' && evt.text) acc = evt.text
            } catch {}
          }
        }
      }
      const reply = acc.trim() || '我先记下了，你可以继续说说当时的具体情形。'
      setTurns((prev) => [...prev, { role: 'ai', text: reply }])
    } catch {
      setTurns((prev) => [...prev, { role: 'ai', text: '这次没整理成功，可以再说一次。' }])
    } finally {
      setLoading(false)
      setStreaming('')
    }
  }

  // 进入页面：消费首页带来的首条输入。
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    const raw = window.sessionStorage.getItem('childos_daily_pending')
    if (raw) {
      window.sessionStorage.removeItem('childos_daily_pending')
      try {
        const pending = JSON.parse(raw) as { text: string }
        if (pending.text?.trim()) void runTurn(pending.text)
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, streaming])

  function handleSubmit(text: string, _mode: InputMode) {
    void runTurn(text)
  }

  return (
    <AppShell>
      <div className="page with-raised-voice">
        <PageHeader title="日常对话" showBack onBack={() => router.push('/home')} />

        {turns.length === 0 && !loading ? (
          <div style={{ fontSize: 14, color: '#6E6E73', lineHeight: 1.6, marginTop: 8 }}>
            把最近最挂心的一个具体场景讲出来——冲突、作业、手机、成绩、沟通都可以。我会结合之前聊过的慢慢理解。
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {turns.map((t, i) => (
            <div
              key={i}
              style={{
                alignSelf: t.role === 'parent' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                fontSize: 15,
                lineHeight: 1.55,
                padding: '10px 14px',
                borderRadius: 16,
                background: t.role === 'parent' ? '#6E6AF8' : 'rgba(110,106,248,0.06)',
                color: t.role === 'parent' ? '#fff' : '#1D1D1F',
                border: t.role === 'parent' ? 'none' : '1px solid rgba(110,106,248,0.10)',
              }}
            >
              {t.text}
            </div>
          ))}

          {loading && streaming ? (
            <div
              style={{
                alignSelf: 'flex-start', maxWidth: '86%', fontSize: 15, lineHeight: 1.55,
                padding: '10px 14px', borderRadius: 16, background: 'rgba(110,106,248,0.06)',
                color: '#1D1D1F', border: '1px solid rgba(110,106,248,0.10)',
              }}
            >
              {streaming}
            </div>
          ) : null}

          {loading && !streaming ? (
            <div style={{ alignSelf: 'flex-start', fontSize: 13, color: '#9A9AA0', padding: '6px 4px' }}>
              正在结合之前聊过的整理…
            </div>
          ) : null}
          <div ref={threadEndRef} />
        </div>
      </div>
      <BottomVoiceBar
        state={loading ? 'transcribing' : 'idle'}
        hint="接着说，或讲一件新的事"
        disabled={loading}
        elevated
        onSubmit={handleSubmit}
      />
    </AppShell>
  )
}

export default function DailyDialoguePage() {
  return (
    <Suspense fallback={<AppShell><div className="page with-raised-voice" /></AppShell>}>
      <DailyDialogueContent />
    </Suspense>
  )
}
