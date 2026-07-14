'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { HiFiInputZone } from '@/components/hifi/HiFiInputZone'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { HiFiMascot } from '@/components/hifi/HiFiMascot'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import { DailyAiMessage, DailyParentBubble } from '@/components/daily/DailyAiMessage'
import { DailyDeepExpandCard } from '@/components/daily/DailyDeepExpandCard'
import type { InputMode } from '@/types/childos'
import type { DailyThinkingChip } from '@/types/daily-message'
import type { DailyAction, DailySection } from '@/types/daily-message'
import {
  clearDailyPending,
  loadDailyThread,
  peekDailyPending,
  readDailyStream,
  saveDailyThread,
  type DailyTurn,
} from '@/lib/daily/dailyStreamClient'
import { collectRecentSectionIds } from '@/lib/daily/dailyThreadUtils'
import { pushAccountSyncToServer } from '@/lib/account/accountSync'
import { useStreamBuffer } from '@/hooks/useStreamBuffer'

const STARTER_CHIPS = ['作业拖延', '情绪爆发', '顶嘴冲突', '手机使用']

function mergeSectionList(existing: DailySection[] | undefined, patch: DailySection): DailySection[] {
  const list = [...(existing || [])]
  const idx = list.findIndex((s) => s.id === patch.id)
  if (idx >= 0) list[idx] = { ...list[idx], ...patch }
  else list.push(patch)
  return list
}

function mergeSectionLists(existing: DailySection[] | undefined, incoming: DailySection[]): DailySection[] {
  let list = [...(existing || [])]
  for (const patch of incoming) {
    list = mergeSectionList(list, patch)
  }
  return list
}

function patchStreamingSection(
  existing: DailySection[] | undefined,
  id: string,
  text: string
): DailySection[] {
  const list = [...(existing || [])]
  const idx = list.findIndex((s) => s.id === id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], streamingText: text }
  }
  return list
}

/** 加载时占位：真实 chips 由 /api/profile/hub（daily-refresh Agent 写入）返回；未到前不展示假模板 */
const LOADING_THINKING_CHIPS: DailyThinkingChip[] = [
  { label: '当前理解', text: '还在了解' },
  { label: '高频场景', text: '还在了解' },
  { label: '学习特点', text: '还在了解' },
  { label: '互动特点', text: '还在了解' },
]

function DailyDialogueContent() {
  const [turns, setTurns] = useState<DailyTurn[]>(() => loadDailyThread())
  const [threadReady, setThreadReady] = useState(false)
  const [thinkingSeed, setThinkingSeed] = useState<DailyThinkingChip[]>(LOADING_THINKING_CHIPS)
  // inputReady：家长能否立即发送下一条。sections+actions 都到 → 立即 true（不必等 hidden/final）。
  const [inputReady, setInputReady] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [mechanismTip, setMechanismTip] = useState('')
  const startedRef = useRef(false)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const queueRef = useRef<string[]>([])
  const streamAbortRef = useRef<AbortController | null>(null)
  const activeIdRef = useRef('')

  // rAF 合并高频流式 setState，降低 prose/section delta 的重渲染抖动。
  const proseBuffer = useStreamBuffer<string>(
    (acc) => patchTurn(activeIdRef.current, { text: acc, showThinking: false })
  )
  const sectionBuffer = useStreamBuffer<{ id: string; text: string }>(
    (d) => patchTurn(activeIdRef.current, (t) => ({ sections: patchStreamingSection(t.sections, d.id, d.text) }))
  )

  /** 按 traceId 更新单条 turn（支持 functional patch，便于 section 流式合并）。 */
  const patchTurn = useCallback(
    (traceId: string, patch: Partial<DailyTurn> | ((turn: DailyTurn) => Partial<DailyTurn>)) => {
      setTurns((prev) =>
        prev.map((t) => {
          if (t.traceId !== traceId) return t
          const nextPatch = typeof patch === 'function' ? patch(t) : patch
          return { ...t, ...nextPatch }
        })
      )
    },
    []
  )

  const flushQueue = useCallback(() => {
    const next = queueRef.current.shift()
    setQueuedCount(queueRef.current.length)
    if (next) void runTurn(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runTurn(text: string) {
    const value = text.trim()
    if (!value) return

    streamAbortRef.current?.abort()
    const abortController = new AbortController()
    streamAbortRef.current = abortController

    setInputReady(false)
    clearDailyPending()

    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    activeIdRef.current = pendingId
    setTurns((prev) => [
      ...prev,
      { role: 'parent', text: value },
      {
        role: 'ai',
        text: '',
        traceId: pendingId,
        streaming: true,
        showThinking: true,
        thinkingChips: thinkingSeed,
        proseComplete: false,
        sectionsComplete: false,
      },
    ])

    try {
      const recentSectionIds = collectRecentSectionIds(turns, 3)
      const warmTurn = turns.some((t) => t.role === 'parent')
      const res = await fetch('/api/daily/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value, recentSectionIds, warmTurn }),
        signal: abortController.signal,
      })

      const activeId = { current: pendingId }

      const result = await readDailyStream(
        res,
        (acc) => proseBuffer.schedule(acc),
        (chips) => patchTurn(activeIdRef.current, { thinkingChips: chips, showThinking: true }),
        (sections: DailySection[]) => patchTurn(activeIdRef.current, { sections }),
        (actions: DailyAction[]) => {
          patchTurn(activeIdRef.current, { actions })
          setInputReady(true)
          flushQueue()
        },
        (traceId: string) => {
          activeId.current = traceId
          activeIdRef.current = traceId
          patchTurn(pendingId, { traceId })
        },
        {
          onProseComplete: () => {
            proseBuffer.flushNow()
            patchTurn(activeIdRef.current, { proseComplete: true })
          },
          onSectionStart: (section) => {
            patchTurn(activeIdRef.current, (t) => ({
              sections: mergeSectionList(t.sections, { ...section, streamingText: '' }),
            }))
          },
          onSectionDelta: (id, st) => {
            sectionBuffer.schedule({ id, text: st })
          },
          onSectionComplete: (section) => {
            sectionBuffer.flushNow()
            patchTurn(activeIdRef.current, (t) => ({
              sections: mergeSectionList(t.sections, { ...section, streamingText: undefined }),
              sectionErrors: (t.sectionErrors || []).filter((eid) => eid !== section.id),
            }))
          },
          onSectionError: (id) => {
            sectionBuffer.flushNow()
            patchTurn(activeIdRef.current, (t) => ({
              sectionErrors: [...new Set([...(t.sectionErrors || []), id])],
              sections: mergeSectionList(t.sections, {
                id,
                label: t.sections?.find((s) => s.id === id)?.label || id,
                kind: 'paragraphs',
                streamingText: undefined,
              }),
            }))
          },
        },
        (sections) => {
          proseBuffer.flushNow()
          sectionBuffer.flushNow()
          patchTurn(activeIdRef.current, (t) => ({
            sections: mergeSectionLists(t.sections, sections),
            sectionsComplete: true,
          }))
        },
        abortController.signal
      )

      if (abortController.signal.aborted) {
        proseBuffer.flushNow()
        sectionBuffer.flushNow()
        patchTurn(activeId.current, {
          streaming: false,
          interrupted: true,
          showThinking: false,
        })
        setInputReady(true)
        return
      }

      const realTraceId = result.traceId || pendingId
      proseBuffer.flushNow()
      sectionBuffer.flushNow()
      if (result.httpError || result.streamError) {
        patchTurn(realTraceId, {
          streaming: false,
          showThinking: false,
          text: result.httpError || result.streamError || '这次没有整理成功，可以再试一次。',
        })
        setInputReady(true)
        flushQueue()
        return
      }

      const reply = result.acc.trim()
      if (!reply) {
        patchTurn(realTraceId, {
          streaming: false,
          showThinking: false,
          text: '这次没有整理成功，可以再试一次。',
        })
        setInputReady(true)
        flushQueue()
        return
      }

      patchTurn(realTraceId, {
        streaming: false,
        showThinking: false,
        thinkingChips: undefined,
        text: reply,
        cards: result.finalCards,
        sections: result.finalSections ?? result.finalCards?.sections,
        actions: result.finalActions ?? result.finalCards?.actions,
        linkedAreas: result.finalLinked,
        sectionsComplete: true,
        proseComplete: true,
      })
      pushAccountSyncToServer()
      // 兜底：若 actions 事件因故未到，final 时再解锁一次
      setInputReady(true)
      flushQueue()

      // 家长可见「这轮记住了没」：延迟查 memory_ledger（job_queue 按 traceId），
      // 让 memory_write job 有时间入队 + 落库。失败静默，不阻塞阅读。
      const labelTraceId = result.traceId || realTraceId
      window.setTimeout(() => {
        fetch(`/api/daily/memory-status?traceId=${encodeURIComponent(labelTraceId)}`)
          .then((r) => r.json())
          .then((json: { ok?: boolean; data?: { status?: { label?: string } } }) => {
            if (json?.ok && json.data?.status?.label) {
              patchTurn(realTraceId, { memoryLabel: json.data.status.label })
            }
          })
          .catch(() => {/* 静默 */})
      }, 2000)
      window.setTimeout(() => {
        fetch('/api/daily/mechanism-tip')
          .then((r) => r.json())
          .then((json: { ok?: boolean; data?: { show?: boolean; message?: string } }) => {
            if (json?.ok && json.data?.show && json.data.message) {
              setMechanismTip(json.data.message)
            }
          })
          .catch(() => {/* 静默 */})
      }, 8000)
    } catch (err) {
      proseBuffer.flushNow()
      sectionBuffer.flushNow()
      if (err instanceof DOMException && err.name === 'AbortError') {
        patchTurn(pendingId, { streaming: false, interrupted: true, showThinking: false })
      } else {
        patchTurn(pendingId, {
          streaming: false,
          showThinking: false,
          text: '这次没有整理成功，可以再试一次。',
        })
      }
      setInputReady(true)
      flushQueue()
    }
  }

  const retrySection = useCallback(
    async (traceId: string, sectionId: string) => {
      const turn = turns.find((t) => t.traceId === traceId)
      const skeleton = turn?.sections?.find((s) => s.id === sectionId)
      if (!skeleton) return
      try {
        const res = await fetch('/api/daily/section-retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ traceId, sectionId, section: skeleton }),
        })
        const json = (await res.json()) as { ok?: boolean; data?: { section?: DailySection } }
        if (json.ok && json.data?.section) {
          patchTurn(traceId, (t) => ({
            sections: mergeSectionList(t.sections, json.data!.section!),
            sectionErrors: (t.sectionErrors || []).filter((id) => id !== sectionId),
          }))
        }
      } catch {
        /* keep error state */
      }
    },
    [patchTurn, turns]
  )

  useEffect(() => {
    let cancelled = false
    // 登录触发：先调 daily-refresh Agent 把后台记忆库转成人话展示层，再读 hub。
    void (async () => {
      try {
        await fetch('/api/account/daily-refresh', { method: 'POST' }).catch(() => {})
      } catch {
        /* 静默：refresh 失败不阻塞阅读 */
      }
      try {
        const res = await fetch('/api/profile/hub')
        const json = (await res.json()) as {
          ok?: boolean
          data?: {
            coreJudgment?: string
            behaviorSummary?: string
            interactionPattern?: string
            supportFocus?: string
            effectiveStrategies?: string
            thinkingChips?: DailyThinkingChip[]
            refreshedAt?: string | null
          }
        }
        if (cancelled || !json.ok || !json.data) return
        const d = json.data
        // 优先用 daily-refresh Agent 产出的人话 chips；没有则不写假模板，保持「还在了解」。
        if (Array.isArray(d.thinkingChips) && d.thinkingChips.length > 0) {
          setThinkingSeed(d.thinkingChips.slice(0, 4))
        }
      } catch {
        /* 保持「还在了解」占位 */
      }
      window.setTimeout(() => {
        if (cancelled) return
        fetch('/api/daily/mechanism-tip')
          .then((r) => r.json())
          .then((json: { ok?: boolean; data?: { show?: boolean; message?: string } }) => {
            if (!cancelled && json?.ok && json.data?.show && json.data.message) {
              setMechanismTip(json.data.message)
            }
          })
          .catch(() => {})
      }, 4000)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/daily/thread?limit=15')
        const json = (await res.json()) as { ok?: boolean; data?: { turns?: DailyTurn[] } }
        if (!cancelled && json.ok && Array.isArray(json.data?.turns) && json.data.turns.length > 0) {
          setTurns(json.data.turns)
          saveDailyThread(json.data.turns)
        }
      } catch {
        /* session fallback */
      } finally {
        if (!cancelled) setThreadReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!threadReady) return
    saveDailyThread(turns)
  }, [turns, threadReady])

  useEffect(() => {
    if (!threadReady) return
    if (startedRef.current) return
    startedRef.current = true
    const pending = peekDailyPending()
    if (pending) void runTurn(pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadReady])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  function handleSubmit(text: string, _mode: InputMode) {
    const value = text.trim()
    if (!value) return
    if (!inputReady) {
      streamAbortRef.current?.abort()
      void runTurn(value)
      return
    }
    void runTurn(value)
  }

  function seedChip(chip: string) {
    if (!inputReady) {
      queueRef.current.push(`想聊聊和孩子有关的：${chip}`)
      setQueuedCount(queueRef.current.length)
      return
    }
    void runTurn(`想聊聊和孩子有关的：${chip}`)
  }

  const lastAiIndex = turns.reduce((idx, t, i) => (t.role === 'ai' ? i : idx), -1)
  const anyStreaming = turns.some((t) => t.streaming)

  return (
    <OnboardingGuard>
      <HiFiMainShell
        activeTab="chat"
        showInput
        inputZone={
          <HiFiInputZone
            busy={!inputReady}
            queuedCount={queuedCount}
            onSubmit={handleSubmit}
          />
        }
      >
        {mechanismTip ? (
          <button
            type="button"
            onClick={() => {
              setMechanismTip('')
              void fetch('/api/daily/mechanism-tip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'dismiss' }),
              }).catch(() => {})
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              width: '100%',
              margin: '0 0 10px',
              padding: '10px 14px',
              border: 'none',
              borderRadius: 12,
              background: 'rgba(111, 159, 86, 0.12)',
              color: '#4d7a3a',
              fontSize: 13,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span>{mechanismTip}</span>
            <span style={{ flexShrink: 0, fontSize: 12, color: '#6f9f56' }}>知道了</span>
          </button>
        ) : null}
        {turns.length === 0 && !anyStreaming ? (
        <article className="hero-card">
          <h2 className="hero-title">直接讲孩子今天发生了什么</h2>
          <p className="hero-copy">不用整理成问题，先把现场过程留下来。</p>
          <HiFiMascot />
        </article>
        ) : null}

        <div className={`chat-feed${turns.length ? ' has-thread' : ''}`}>
          {turns.length === 0 && !anyStreaming ? (
            <div className="message-row ai">
              <div className="bubble">
                <div className="bubble-section">
                  <span className="section-label">你可以从这里开始</span>
                  <div className="section-body">
                    <p>直接讲今天发生了什么，或者先选一个方向：</p>
                  </div>
                </div>
                <div className="suggestion-strip">
                  {STARTER_CHIPS.map((chip) => (
                    <button key={chip} type="button" className="pill" onClick={() => seedChip(chip)}>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {turns.map((t, i) =>
            t.role === 'parent' ? (
              <DailyParentBubble key={i} text={t.text} />
            ) : (
              <div key={i} className="ai-turn-block">
                <DailyAiMessage
                  text={t.text}
                  traceId={t.traceId}
                  sections={t.sections}
                  actions={t.actions}
                  cards={t.cards}
                  streaming={t.streaming}
                  proseComplete={t.proseComplete ?? !t.streaming}
                  sectionsComplete={t.sectionsComplete ?? !t.streaming}
                  sectionErrors={t.sectionErrors}
                  interrupted={t.interrupted}
                  thinkingChips={t.thinkingChips}
                  showThinking={t.showThinking}
                  memoryLabel={t.memoryLabel}
                  showActions={i === lastAiIndex}
                  animateSections={i === lastAiIndex}
                  onFollowUpText={(seed) => void runTurn(seed)}
                  onRetrySection={
                    t.traceId ? (sectionId) => void retrySection(t.traceId!, sectionId) : undefined
                  }
                  onDeepExpand={() => {
                    if (t.traceId) patchTurn(t.traceId, { deepExpanded: true })
                  }}
                />
                {t.deepExpanded ? (
                  <DailyDeepExpandCard
                    sections={(t.sections || []).filter((s) => s.hidden)}
                    prose={t.text}
                    traceId={t.traceId}
                    onClose={() => {
                      if (t.traceId) patchTurn(t.traceId, { deepExpanded: false })
                    }}
                  />
                ) : null}
              </div>
            )
          )}

          <div ref={threadEndRef} />
        </div>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

export default function DailyDialoguePage() {
  return (
    <Suspense fallback={null}>
      <DailyDialogueContent />
    </Suspense>
  )
}
