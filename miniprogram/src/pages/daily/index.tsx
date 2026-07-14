import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DailyAction, DailySection, DailyThinkingChip } from '@yujian/contracts'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { HiFiInputZone } from '@/components/hifi/HiFiInputZone'
import { HiFiMascot } from '@/components/hifi/HiFiMascot'
import { DailyAiMessage } from '@/components/daily/DailyAiMessage'
import { DailyDeepExpandCard } from '@/components/daily/DailyDeepExpandCard'
import { DailyParentBubble } from '@/components/daily/DailyParentBubble'
import { useTabBar } from '@/hooks/useTabBar'
import { useChatAutoScroll } from '@/hooks/useChatAutoScroll'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { collectRecentSectionIds } from '@/lib/dailyThreadUtils'
import { mergeStreamChunk, stripParentFacingMarkdown } from '@/lib/textDisplay'
import { apiRequest } from '@/services/api'
import { pushAccountSyncToServer } from '@/services/accountSync'
import { fetchCurrentUser } from '@/services/auth'
import {
  abortStream,
  loadDailyThread,
  saveDailyThread,
  streamDailyMessage,
  type DailyTurn,
} from '@/services/dailyStream'
import { hydrateDailyThreadFromServer } from '@/services/profilePipeline'
import { requireOnboardingComplete } from '@/utils/navigation'
import './index.scss'

const STARTER_CHIPS = ['作业拖延', '情绪爆发', '顶嘴冲突', '手机使用']

const LOADING_THINKING_CHIPS: DailyThinkingChip[] = [
  { label: '当前理解', text: '还在了解' },
  { label: '高频场景', text: '还在了解' },
  { label: '学习特点', text: '还在了解' },
  { label: '互动特点', text: '还在了解' },
]

function mergeSection(sections: DailySection[] | undefined, section: DailySection): DailySection[] {
  const list = [...(sections || [])]
  const idx = list.findIndex((s) => s.id === section.id)
  if (idx >= 0) list[idx] = { ...list[idx], ...section }
  else list.push(section)
  return list
}

export default function DailyPage() {
  useTabBar('chat')
  usePublicPageShare({
    title: '育见 · 和孩子一起聊聊今天',
    path: SHARE_PATHS.daily,
  })
  const [turns, setTurns] = useState<DailyTurn[]>(() => loadDailyThread())
  const [threadReady, setThreadReady] = useState(false)
  const [thinkingSeed, setThinkingSeed] = useState<DailyThinkingChip[]>(LOADING_THINKING_CHIPS)
  const [inputReady, setInputReady] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [sending, setSending] = useState(false)
  const [animatingSectionId, setAnimatingSectionId] = useState<string | null>(null)
  const [mechanismTip, setMechanismTip] = useState('')

  const abortRef = useRef({ aborted: false })
  const streamTaskRef = useRef<Taro.RequestTask<unknown> | null>(null)
  const aiIndexRef = useRef(-1)
  const queueRef = useRef<string[]>([])
  const turnsRef = useRef(turns)
  turnsRef.current = turns

  const refreshMechanismTip = useCallback(() => {
    void apiRequest<{ show?: boolean; message?: string }>('/api/daily/mechanism-tip', {
      method: 'GET',
    }).then((res) => {
      if (res.ok && res.data.show && res.data.message) {
        setMechanismTip(res.data.message)
      }
    })
  }, [])

  const dismissMechanismTipUi = useCallback(() => {
    setMechanismTip('')
    void apiRequest('/api/daily/mechanism-tip', {
      method: 'POST',
      data: { action: 'dismiss' },
    })
  }, [])

  useDidShow(async () => {
    const user = await fetchCurrentUser()
    requireOnboardingComplete(user)
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      void apiRequest('/api/account/daily-refresh', { method: 'POST' })
      const hub = await apiRequest<{ thinkingChips?: DailyThinkingChip[] }>('/api/profile/hub', {
        method: 'GET',
      })
      if (!cancelled && hub.ok && Array.isArray(hub.data.thinkingChips) && hub.data.thinkingChips.length) {
        setThinkingSeed(hub.data.thinkingChips.slice(0, 4))
      }
      const remote = await hydrateDailyThreadFromServer()
      if (!cancelled && remote.length > 0) setTurns(remote)
      if (!cancelled) setThreadReady(true)
      // daily-refresh 可能入队 deep_mechanism；稍后再查 tip
      if (!cancelled) {
        setTimeout(() => {
          if (!cancelled) refreshMechanismTip()
        }, 4000)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshMechanismTip])

  useEffect(() => {
    if (!threadReady) return
    saveDailyThread(turns)
  }, [turns, threadReady])

  const flushQueue = useCallback(() => {
    const next = queueRef.current.shift()
    setQueuedCount(queueRef.current.length)
    if (next) void runTurn(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchAiTurn = useCallback((patch: Partial<DailyTurn> | ((turn: DailyTurn) => Partial<DailyTurn>)) => {
    setTurns((prev) => {
      const next = [...prev]
      const idx = aiIndexRef.current
      if (idx < 0 || !next[idx]) return prev
      const delta = typeof patch === 'function' ? patch(next[idx]) : patch
      next[idx] = { ...next[idx], ...delta }
      return next
    })
  }, [])

  const pollMemoryLabel = useCallback((traceId: string) => {
    setTimeout(() => {
      void apiRequest<{ status?: { label?: string } | null }>(
        `/api/daily/memory-status?traceId=${encodeURIComponent(traceId)}`,
        { method: 'GET' }
      ).then((res) => {
        const label =
          res.ok && res.data.status && typeof res.data.status === 'object'
            ? res.data.status.label
            : undefined
        if (label) patchAiTurn({ memoryLabel: label })
      })
    }, 2000)
  }, [patchAiTurn])

  const scrollFingerprint = useMemo(() => {
    const last = turns[turns.length - 1]
    if (!last) return String(turns.length)
    const sectionChars =
      last.sections?.reduce((sum, s) => {
        const streaming = s.streamingText?.length || 0
        const paras = s.paragraphs?.join('').length || 0
        const items = s.items?.join('').length || 0
        return sum + streaming + paras + items
      }, 0) ?? 0
    return [
      turns.length,
      last.text?.length ?? 0,
      sectionChars,
      last.streaming ? 1 : 0,
      last.sectionsComplete ? 1 : 0,
      last.showThinking ? 1 : 0,
    ].join('|')
  }, [turns])

  const { scrollIntoView, onScroll, scrollToBottom, resumeFollowOnSend, anchorId, setViewHeight } =
    useChatAutoScroll([scrollFingerprint])

  useEffect(() => {
    const timer = setTimeout(() => {
      Taro.createSelectorQuery()
        .select('#daily-chat-scroll')
        .boundingClientRect((rect) => {
          if (rect && !Array.isArray(rect) && rect.height) setViewHeight(rect.height)
        })
        .exec()
    }, 80)
    return () => clearTimeout(timer)
  }, [setViewHeight, turns.length])

  const runTurn = async (text: string) => {
    const value = text.trim()
    if (!value || sending) return

    abortRef.current.aborted = false
    abortStream(streamTaskRef.current)
    streamTaskRef.current = null
    setSending(true)
    setInputReady(false)

    resumeFollowOnSend()

    const parentTurn: DailyTurn = { role: 'parent', text: value }
    const aiTurn: DailyTurn = {
      role: 'ai',
      text: '',
      streaming: true,
      showThinking: true,
      thinkingChips: thinkingSeed,
      proseComplete: false,
      sectionsComplete: false,
      sections: [],
      actions: [],
    }

    setTurns((prev) => {
      const next = [...prev, parentTurn, aiTurn]
      aiIndexRef.current = next.length - 1
      return next
    })

    setTimeout(() => scrollToBottom(true), 32)
    setTimeout(() => scrollToBottom(true), 120)
    setTimeout(() => scrollToBottom(true), 280)

    const recentSectionIds = collectRecentSectionIds(turnsRef.current, 3)
    const warmTurn = turnsRef.current.some((t) => t.role === 'parent')

    try {
    const result = await streamDailyMessage(
      value,
      {
        onStart: (traceId) => patchAiTurn({ traceId }),
        onThinking: (chips) => patchAiTurn({ thinkingChips: chips, showThinking: true }),
        onDelta: (display) =>
          patchAiTurn((t) => {
            const cleaned = stripParentFacingMarkdown(display)
            const prev = t.text || ''
            // 异常短于旧值则忽略回退（防流式重放导致梯形）
            if (t.streaming && cleaned.length + 8 < prev.length) return {}
            return { text: cleaned, showThinking: false }
          }),
        onProseComplete: () => patchAiTurn({ proseComplete: true }),
        onSectionStart: (section) =>
          patchAiTurn((t) => ({
            sections: mergeSection(t.sections, { ...section, streamingText: '' }),
          })),
        onSectionDelta: (id, chunk) =>
          patchAiTurn((t) => ({
            sections: (t.sections || []).map((s) =>
              s.id === id
                ? { ...s, streamingText: mergeStreamChunk(s.streamingText || '', chunk) }
                : s
            ),
          })),
        onSectionComplete: (section) => {
          patchAiTurn((t) => ({
            sections: mergeSection(t.sections, { ...section, streamingText: undefined }),
            sectionErrors: (t.sectionErrors || []).filter((eid) => eid !== section.id),
          }))
          setAnimatingSectionId(section.id)
          setTimeout(() => {
            setAnimatingSectionId((current) => (current === section.id ? null : current))
          }, 260)
        },
        onSectionError: (id) =>
          patchAiTurn((t) => ({
            sectionErrors: [...new Set([...(t.sectionErrors || []), id])],
          })),
        onSectionsComplete: () => patchAiTurn({ sectionsComplete: true }),
        onActions: (actions: DailyAction[]) => {
          patchAiTurn({ actions })
        },
      },
      {
        warmTurn,
        recentSectionIds,
        abortRef: abortRef.current,
        taskRef: streamTaskRef,
      }
    )

    if (abortRef.current.aborted) {
      patchAiTurn({ streaming: false, interrupted: true, showThinking: false })
      return
    }

    if (result.httpError || result.streamError) {
      patchAiTurn({
        streaming: false,
        showThinking: false,
        text: result.httpError || result.streamError || '这次没有整理成功，可以再试一次。',
      })
      return
    }

    const finalText = (result.finalText || result.acc || '').trim()
    if (!finalText) {
      patchAiTurn({
        streaming: false,
        showThinking: false,
        text: '这次没有整理成功，可以再试一次。',
      })
      return
    }

    patchAiTurn({
      text: finalText,
      streaming: false,
      showThinking: false,
      thinkingChips: undefined,
      sections: result.finalSections || undefined,
      actions: result.finalActions || undefined,
      sectionsComplete: true,
      proseComplete: true,
    })

    if (result.traceId) pollMemoryLabel(result.traceId)
    // 有效轮可能触发第 10 轮加厚；轮询 tip（job 异步）
    setTimeout(() => refreshMechanismTip(), 8000)
    pushAccountSyncToServer()
    } finally {
      setInputReady(true)
      setSending(false)
      flushQueue()
    }
  }

  const retrySection = useCallback(async (traceId: string, sectionId: string) => {
    const turn = turnsRef.current.find((t) => t.traceId === traceId)
    const skeleton = turn?.sections?.find((s) => s.id === sectionId)
    if (!skeleton) return
    const res = await apiRequest<{ section?: DailySection }>('/api/daily/section-retry', {
      method: 'POST',
      data: { traceId, sectionId, section: skeleton },
    })
    if (!res.ok || !res.data.section) return
    setTurns((prev) =>
      prev.map((t) => {
        if (t.traceId !== traceId) return t
        return {
          ...t,
          sections: mergeSection(t.sections, res.data.section!),
          sectionErrors: (t.sectionErrors || []).filter((id) => id !== sectionId),
        }
      })
    )
  }, [])

  const interruptStreaming = useCallback(() => {
    abortRef.current.aborted = true
    abortStream(streamTaskRef.current)
    streamTaskRef.current = null
    setTurns((prev) => {
      const next = [...prev]
      const idx = aiIndexRef.current
      if (idx >= 0 && next[idx]?.streaming) {
        next[idx] = { ...next[idx], streaming: false, interrupted: true, showThinking: false }
      }
      return next
    })
    setInputReady(true)
    setSending(false)
  }, [])

  const handleSubmit = (text: string) => {
    const value = text.trim()
    if (!value) return
    // busy 时排队下一条，不打断当前生成（产品决策）
    if (!inputReady || sending) {
      queueRef.current.push(value)
      setQueuedCount(queueRef.current.length)
      return
    }
    void runTurn(value)
  }

  const seedChip = (chip: string) => {
    const msg = `想聊聊和孩子有关的：${chip}`
    if (!inputReady || sending) {
      queueRef.current.push(msg)
      setQueuedCount(queueRef.current.length)
      return
    }
    void runTurn(msg)
  }

  const lastAiIndex = turns.reduce((idx, t, i) => (t.role === 'ai' ? i : idx), -1)
  const anyStreaming = turns.some((t) => t.streaming)

  return (
    <HiFiMainShell
      disableEntering
      showInput
      inputZone={
        <HiFiInputZone
          busy={!inputReady || sending}
          queuedCount={queuedCount}
          voiceMode='send'
          onSubmit={handleSubmit}
        />
      }
    >
      <View className='daily-scroll-wrap'>
        {mechanismTip ? (
          <View className='mechanism-tip' onClick={dismissMechanismTipUi}>
            <Text className='mechanism-tip-text'>{mechanismTip}</Text>
            <Text className='mechanism-tip-dismiss'>知道了</Text>
          </View>
        ) : null}
        <ScrollView
          id='daily-chat-scroll'
          className='chat-scroll-view'
          scrollY
          scrollWithAnimation
          scrollIntoView={scrollIntoView}
          onScroll={onScroll}
          enhanced
          showScrollbar={false}
        >
      {turns.length === 0 && !anyStreaming ? (
        <View className='hero-card has-mascot'>
          <Text className='hero-title'>直接讲孩子今天发生了什么</Text>
          <Text className='hero-copy'>不用整理成问题，先把现场过程留下来。</Text>
          <HiFiMascot />
        </View>
      ) : null}

      <View className={`chat-feed${turns.length ? ' has-thread' : ''}`}>
        {turns.length === 0 && !anyStreaming ? (
          <View className='message-row ai'>
            <View className='bubble'>
              <View className='bubble-section'>
                <Text className='section-label'>你可以从这里开始</Text>
                <View className='section-body'>
                  <Text>直接讲今天发生了什么，或者先选一个方向：</Text>
                </View>
              </View>
              <View className='suggestion-strip'>
                {STARTER_CHIPS.map((chip) => (
                  <Text key={chip} className='pill chip-float' onClick={() => seedChip(chip)}>
                    {chip}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {turns.map((t, i) =>
          t.role === 'parent' ? (
            <DailyParentBubble key={`p-${i}`} text={t.text} />
          ) : (
            <View key={`a-${i}-${t.traceId || i}`} className='ai-turn-block'>
              <DailyAiMessage
                text={t.text}
                traceId={t.traceId}
                sections={t.sections}
                actions={t.actions}
                streaming={t.streaming}
                proseComplete={t.proseComplete ?? !t.streaming}
                sectionsComplete={t.sectionsComplete ?? !t.streaming}
                thinkingChips={t.thinkingChips}
                showThinking={t.showThinking}
                showActions={i === lastAiIndex}
                sectionErrors={t.sectionErrors}
                interrupted={t.interrupted}
                memoryLabel={t.memoryLabel}
                onFollowUpText={(seed) => handleSubmit(seed)}
                animatingSectionId={animatingSectionId}
                onRetrySection={
                  t.traceId ? (sectionId) => void retrySection(t.traceId!, sectionId) : undefined
                }
                onDeepExpand={() => {
                  setTurns((prev) => {
                    const next = [...prev]
                    if (!next[i]) return prev
                    next[i] = { ...next[i], deepExpanded: true }
                    return next
                  })
                }}
              />
              {t.deepExpanded ? (
                <DailyDeepExpandCard
                  sections={(t.sections || []).filter((s) => s.hidden)}
                  traceId={t.traceId}
                  onClose={() => {
                    setTurns((prev) => {
                      const next = [...prev]
                      if (!next[i]) return prev
                      next[i] = { ...next[i], deepExpanded: false }
                      return next
                    })
                  }}
                />
              ) : null}
            </View>
          )
        )}
      </View>
          <View id={anchorId} className='scroll-anchor' />
        </ScrollView>
      </View>
    </HiFiMainShell>
  )
}
