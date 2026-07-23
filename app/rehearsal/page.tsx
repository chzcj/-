'use client'

import { useEffect, useRef, useState } from 'react'
import { HiFiInputZone } from '@/components/hifi/HiFiInputZone'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import {
  SimulationParentBubble,
  SimulationSecondMeBubble,
  SimulationSystemHintBubble,
  SimulationThinkingBubble,
} from '@/components/rehearsal/SimulationSecondMeBubble'
import type { RehearsalAnalyzeData } from '@/components/rehearsal/RehearsalOutput'
import { parseRehearsalStreamEvent } from '@/types/rehearsal-stream'
import {
  REHEARSAL_SCENES,
  type RehearsalScene,
} from '@/data/rehearsalScenes'
import { getChildDisplayName } from '@/lib/storage/childStorage'
import { saveTaskFromRehearsal } from '@/lib/storage/taskStorage'
import { RehearsalDialogueCapture } from '@/components/rehearsal/RehearsalDialogueCapture'
import { RehearsalEndPanel } from '@/components/rehearsal/RehearsalEndPanel'
import type { InputMode } from '@/types/childos'
import {
  readLastDialogueAnalysisId,
  readRehearsalScenesCache,
  writeLastDialogueAnalysisId,
  writeRehearsalScenesCache,
} from '@/lib/rehearsal-scenes-cache'
import { pickRehearsalTaskTitle } from '@yujian/contracts/rehearsal-end'
import {
  pickRehearsalL3Opening,
  type RehearsalSceneBriefL3,
} from '@yujian/contracts/rehearsal-scene-brief'
import { useRouter } from 'next/navigation'

type SimulationStep = 'entry' | 'confirm' | 'active' | 'end'

type FeedItem =
  | { type: 'parent'; text: string }
  | {
      type: 'child'
      childText: string
      hintTitle: string
      hintText: string
      suggestedTitle?: string
      suggestedText?: string
    }
  | { type: 'system_hint'; text: string }
  | { type: 'thinking' }

const CHECKPOINT_EVERY = 4

function mapAnalyzeToSecondMe(data: RehearsalAnalyzeData) {
  const childText =
    data.possibleChildReaction?.immediateReaction?.trim() ||
    '……（孩子暂时没有接话）'

  const hintTitle = '他可能是这样想的'
  const hintText =
    data.childLikelyHearing ||
    data.possibleChildReaction?.innerReaction ||
    data.explanation ||
    '可以继续换一句更轻的开口方式。'

  return {
    childText,
    hintTitle,
    hintText,
    suggestedTitle: data.showSuggestedWording ? '您可以这样说' : undefined,
    suggestedText: data.showSuggestedWording
      ? data.suggestedWordingHint || data.saferVersion || data.suggestedWording
      : undefined,
    dailyToneReminder: data.dailyToneDetected ? data.dailyToneReminder : undefined,
  }
}

export default function RehearsalPage() {
  const router = useRouter()
  const [step, setStep] = useState<SimulationStep>('entry')
  const [scenes, setScenes] = useState<RehearsalScene[]>(REHEARSAL_SCENES)
  const [scenesLoading, setScenesLoading] = useState(true)
  const [rankedFromDialogue, setRankedFromDialogue] = useState(false)
  const [selectedId, setSelectedId] = useState(REHEARSAL_SCENES[0].id)
  const [summary, setSummary] = useState(REHEARSAL_SCENES[0].summary)
  const [sceneTitle, setSceneTitle] = useState(REHEARSAL_SCENES[0].title)
  const [handoffDigest, setHandoffDigest] = useState<{
    parentText?: string
    rehearsalGoal?: string
    retrievalPackDigest?: Record<string, unknown>
  }>({})
  const [statusText, setStatusText] = useState('')
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [round, setRound] = useState(0)
  const [roundsSinceCheckpoint, setRoundsSinceCheckpoint] = useState(0)
  const [showCheckpoint, setShowCheckpoint] = useState(false)
  const [endData, setEndData] = useState<RehearsalAnalyzeData | null>(null)
  const [taskSaved, setTaskSaved] = useState(false)
  const [tonightSaved, setTonightSaved] = useState(false)
  const [rehearsalTraceId, setRehearsalTraceId] = useState<string | undefined>()
  const [sceneSituation, setSceneSituation] = useState('')
  const [childUnderstanding, setChildUnderstanding] = useState('')
  const [sceneBrief, setSceneBrief] = useState<RehearsalSceneBriefL3 | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [lastDialogueAnalysisId, setLastDialogueAnalysisId] = useState<string | null>(null)
  const feedEndRef = useRef<HTMLDivElement>(null)

  const selectedScene: RehearsalScene =
    scenes.find((s) => s.id === selectedId) || scenes[0] || REHEARSAL_SCENES[0]

  function matchSceneFromText(raw: string): RehearsalScene {
    const pool = scenes.length ? scenes : REHEARSAL_SCENES
    const t = raw || ''
    if (/手机|平板|游戏/.test(t)) return pool.find((s) => s.id === 'phone') || pool[0]
    if (/起床|出门|迟到|早上/.test(t)) return pool.find((s) => s.id === 'morning') || pool[0]
    if (/成绩|分数|考试|卷子/.test(t)) return pool.find((s) => s.id === 'grades') || pool[0]
    if (/吵|说重了|僵|修复|老师|学校|告状/.test(t)) {
      return pool.find((s) => s.id === 'after_conflict') || pool[0]
    }
    return pool.find((s) => s.id === 'homework_start') || pool[0]
  }

  useEffect(() => {
    const cached = readRehearsalScenesCache()
    if (cached) {
      setScenes(cached.scenes)
      setRankedFromDialogue(cached.rankedFromDialogue)
      setScenesLoading(false)
    }
    void (async () => {
      if (!cached) setScenesLoading(true)
      try {
        const res = await fetch('/api/rehearsal/scenes')
        const json = (await res.json()) as {
          ok?: boolean
          data?: { scenes?: RehearsalScene[]; rankedFromDialogue?: boolean }
        }
        if (!json.ok || !json.data?.scenes?.length) {
          if (!cached) setRankedFromDialogue(false)
          return
        }
        setRankedFromDialogue(Boolean(json.data.rankedFromDialogue))
        const next = json.data.scenes.map((patch) => {
          const base = REHEARSAL_SCENES.find((s) => s.id === patch.id)
          return {
            id: patch.id,
            title: patch.title || base?.title || '练一句开口',
            subtitle: patch.subtitle || patch.lede || base?.subtitle || '',
            lede: patch.lede || patch.subtitle || base?.lede,
            mentionCountHint: patch.mentionCountHint,
            summary: patch.summary || base?.summary || '',
            placeholder: base?.placeholder || '描述一下你想练的场景。',
            seed: patch.seed || base?.seed || patch.title || '',
            openingHint: patch.openingHint || base?.openingHint,
            openingChild: patch.openingChild || base?.openingChild,
            openingHintTitle: patch.openingHintTitle || base?.openingHintTitle,
          } satisfies RehearsalScene
        })
        setScenes(next)
        writeRehearsalScenesCache(next, Boolean(json.data.rankedFromDialogue))
      } catch {
        /* keep static */
      } finally {
        setScenesLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    let lastId = readLastDialogueAnalysisId()
    void (async () => {
      if (!lastId) {
        try {
          const res = await fetch('/api/rehearsal/dialogue-analyze/latest', { credentials: 'include' })
          const json = await res.json()
          if (json.ok && json.data?.analysisId?.startsWith('da_')) {
            lastId = json.data.analysisId
            writeLastDialogueAnalysisId(json.data.analysisId)
          }
        } catch {
          /* ignore */
        }
      }
      setLastDialogueAnalysisId(lastId)
    })()
  }, [])

  useEffect(() => {
    try {
      const handoffRaw = sessionStorage.getItem('childos_rehearsal_handoff')
      if (handoffRaw) {
        sessionStorage.removeItem('childos_rehearsal_handoff')
        const handoff = JSON.parse(handoffRaw) as {
          sceneId?: string
          seedText?: string
          parentText?: string
          rehearsalGoal?: string
          traceId?: string
          retrievalPackDigest?: {
            understandingCard?: string
            evidenceBasis?: string
            deepAnalysis?: string[]
            adviceSeed?: string
            confidenceMode?: string
            linkedAreas?: string[]
          }
        }
        const matched =
          scenes.find((s) => s.id === handoff.sceneId) ||
          matchSceneFromText(handoff.seedText || handoff.parentText || '')
        setSelectedId(matched.id)
        setSceneTitle(matched.title)
        setSummary(
          [handoff.parentText, handoff.rehearsalGoal, handoff.seedText]
            .filter((part): part is string => Boolean(part?.trim()))
            .join('。')
            .slice(0, 800) || matched.summary
        )
        // v4 P0-4a：存储 handoff digest，供 brief route 调用时携带
        setHandoffDigest({
          parentText: handoff.parentText,
          rehearsalGoal: handoff.rehearsalGoal,
          retrievalPackDigest: handoff.retrievalPackDigest as Record<string, unknown> | undefined,
        })
        setStep('confirm')
        return
      }
      const seed = sessionStorage.getItem('childos_rehearsal_scene_seed')
      if (!seed) return
      sessionStorage.removeItem('childos_rehearsal_scene_seed')
      const matched =
        scenes.find(
          (s) => s.title.includes(seed) || s.seed === seed || seed.includes(s.title.slice(0, 2))
        ) || matchSceneFromText(seed)
      setSelectedId(matched.id)
      setSummary(seed.length > 40 ? seed : matched.summary)
      setSceneTitle(matched.title)
      setStep('confirm')
    } catch {
      /* ignore */
    }
  }, [scenes])

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [feed, loading, step])

  function openSceneBrief(sceneId: string) {
    if (briefLoading) return
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return
    setSelectedId(scene.id)
    setSceneTitle(scene.title)
    setSummary(scene.summary)
    setSceneSituation(scene.summary)
    setChildUnderstanding('')
    setSceneBrief(null)
    setStep('confirm')
    void (async () => {
      setBriefLoading(true)
      try {
        const res = await fetch('/api/rehearsal/brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sceneId: scene.id,
            // v4 P0-4a：携带交流页上下文，让预演不冷启动
            parentText: handoffDigest.parentText || undefined,
            rehearsalGoal: handoffDigest.rehearsalGoal || undefined,
            retrievalPackDigest: handoffDigest.retrievalPackDigest || undefined,
          }),
        })
        const json = (await res.json()) as {
          ok?: boolean
          data?: {
            sceneSituation?: string
            childUnderstanding?: string
            understandingBullets?: string[]
            openingHint?: string
            openingChild?: string
            openingHintTitle?: string
            initialStatusText?: string
          }
        }
        if (json.ok && json.data) {
          const bullets = (json.data.understandingBullets || [])
            .map((b) => String(b || '').trim())
            .filter((b) => b.length > 4)
          setSceneSituation(json.data.sceneSituation || scene.summary)
          setChildUnderstanding(
            bullets.length >= 2
              ? bullets.join('\n')
              : json.data.childUnderstanding || ''
          )
          setSceneBrief({
            openingHint: json.data.openingHint || '',
            openingChild: json.data.openingChild || '',
            openingHintTitle: json.data.openingHintTitle || '他可能是这样想的',
            initialStatusText: json.data.initialStatusText || '',
          })
          if (json.data.openingHint || json.data.openingChild) {
            setScenes((prev) =>
              prev.map((s) =>
                s.id === scene.id
                  ? {
                      ...s,
                      openingHint: json.data!.openingHint || s.openingHint,
                      openingChild: json.data!.openingChild || s.openingChild,
                      openingHintTitle: json.data!.openingHintTitle || s.openingHintTitle,
                    }
                  : s
              )
            )
          }
        } else {
          setSceneSituation(scene.summary)
          setChildUnderstanding('')
          setSceneBrief(null)
        }
      } catch {
        setSceneSituation(scene.summary)
        setChildUnderstanding('')
        setSceneBrief(null)
      } finally {
        setBriefLoading(false)
      }
    })()
  }

  function startSimulation() {
    openSceneBrief(selectedId)
  }

  function enterRehearsal() {
    const scene = selectedScene
    const firstUnderstanding = (childUnderstanding || sceneSituation || summary).split('\n')[0]?.trim()
    const l3 = pickRehearsalL3Opening(sceneBrief, scene, firstUnderstanding)
    setRound(0)
    setRoundsSinceCheckpoint(0)
    setShowCheckpoint(false)
    setEndData(null)
    setTaskSaved(false)
    setTonightSaved(false)
    if (l3.initialStatusText) setStatusText(l3.initialStatusText)
    setFeed([
      {
        type: 'child',
        childText: l3.openingChild,
        hintTitle: l3.openingHintTitle,
        hintText: l3.openingHint || firstUnderstanding || scene.summary.slice(0, 80),
      },
    ])
    setStep('active')
  }

  async function sendSimulationText(text: string, _mode: InputMode) {
    const value = text.trim()
    if (!value || loading || step !== 'active') return

    setFeed((prev) => [...prev, { type: 'parent', text: value }, { type: 'thinking' }])
    setLoading(true)

    try {
      const res = await fetch('/api/rehearsal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentText: `【预演场景：${sceneTitle}】\n场景摘要：${summary}\n家长说：${value}`,
          fromSpecialFeature: true,
          parentRoundCount: round + 1,
        }),
      })

      // 流式 NDJSON（profile-aware 路径）vs JSON（conflict/basic 旧路径）
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('ndjson') && res.body) {
        // 移除 thinking
        setFeed((prev) => prev.filter((item) => item.type !== 'thinking'))
        let reactionAccum = ''
        let finalData: (RehearsalAnalyzeData & { traceId?: string }) | null = null
        let childBubbleInserted = false

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
            const evt = parseRehearsalStreamEvent(line)
            if (!evt) continue
            if (evt.type === 'reaction_delta') {
              reactionAccum += evt.delta
              if (!childBubbleInserted) {
                childBubbleInserted = true
                setFeed((prev) => [
                  ...prev,
                  {
                    type: 'child',
                    childText: reactionAccum,
                    hintTitle: '他可能是这样听到的',
                    hintText: '…',
                  },
                ])
              } else {
                setFeed((prev) => {
                  const next = [...prev]
                  for (let i = next.length - 1; i >= 0; i--) {
                    if (next[i].type === 'child') {
                      next[i] = { ...next[i], childText: reactionAccum } as FeedItem
                      break
                    }
                  }
                  return next
                })
              }
            } else if (evt.type === 'final') {
              finalData = evt.data as RehearsalAnalyzeData & { traceId?: string }
            } else if (evt.type === 'error') {
              setFeed((prev) => [
                ...prev,
                {
                  type: 'child',
                  childText: '……（这次没有模拟出来，你可以换一句更轻的试试）',
                  hintTitle: '预演暂时中断',
                  hintText: evt.message || '网络或分析服务暂时不可用。',
                },
              ])
              setLoading(false)
              return
            }
          }
        }

        if (finalData) {
          const data = finalData
          if (data.traceId) setRehearsalTraceId(data.traceId)
          const reply = mapAnalyzeToSecondMe(data)
          setEndData(data)
          // 用 final 完整字段替换流式占位（补全 hearing/hint/suggested）
          setFeed((prev) => {
            const next = [...prev]
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].type === 'child') {
                next[i] = { type: 'child', ...reply } as FeedItem
                break
              }
            }
            return next
          })
          if (reply.dailyToneReminder) {
            setFeed((prev) => [...prev, { type: 'system_hint', text: reply.dailyToneReminder! }])
          }
          setStatusText(
            reply.hintTitle.includes('松动') || reply.hintTitle.includes('具体')
              ? '当前状态：孩子开始谈条件，有一点松动'
              : '当前状态：孩子仍有防御，需要先降压力'
          )
          setRound((r) => r + 1)
          setRoundsSinceCheckpoint((c) => {
            const next = c + 1
            if (next >= CHECKPOINT_EVERY) {
              setShowCheckpoint(true)
              return 0
            }
            return next
          })
        }
      } else {
        // 旧 JSON 路径（conflict/basic）
        const json = await res.json()
        setFeed((prev) => prev.filter((item) => item.type !== 'thinking'))

        if (json.ok && json.data) {
          const data = json.data as RehearsalAnalyzeData & { traceId?: string }
          if (data.traceId) setRehearsalTraceId(data.traceId)
          const reply = mapAnalyzeToSecondMe(data)
          setEndData(data)
          if (reply.dailyToneReminder) {
            setFeed((prev) => [...prev, { type: 'system_hint', text: reply.dailyToneReminder! }])
          }
          setFeed((prev) => [...prev, { type: 'child', ...reply }])
          setStatusText(
            reply.hintTitle.includes('松动') || reply.hintTitle.includes('具体')
              ? '当前状态：孩子开始谈条件，有一点松动'
              : '当前状态：孩子仍有防御，需要先降压力'
          )
          setRound((r) => r + 1)
          setRoundsSinceCheckpoint((c) => {
            const next = c + 1
            if (next >= CHECKPOINT_EVERY) {
              setShowCheckpoint(true)
              return 0
            }
            return next
          })
        } else {
          setFeed((prev) => [
            ...prev,
            {
              type: 'child',
              childText: '……（这次没有模拟出来，你可以换一句更轻的试试）',
              hintTitle: '预演暂时中断',
              hintText: json.error?.message || '网络或分析服务暂时不可用。',
            },
          ])
        }
      }
    } catch {
      setFeed((prev) => prev.filter((item) => item.type !== 'thinking'))
      setFeed((prev) => [
        ...prev,
        {
          type: 'child',
          childText: '……（这次没有模拟出来）',
          hintTitle: '网络不太稳定',
          hintText: '请稍后再试，或换一句更轻的开口方式。',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function restartSimulation() {
    setSelectedId(REHEARSAL_SCENES[0].id)
    setSummary(scenes[0]?.summary || REHEARSAL_SCENES[0].summary)
    setSceneTitle(scenes[0]?.title || REHEARSAL_SCENES[0].title)
    setFeed([])
    setRound(0)
    setRoundsSinceCheckpoint(0)
    setShowCheckpoint(false)
    setEndData(null)
    setTaskSaved(false)
    setTonightSaved(false)
    setRehearsalTraceId(undefined)
    setStep('entry')
  }

  function saveDirection() {
    const title = pickRehearsalTaskTitle(endData)
    if (!title.trim()) return
    void saveTaskFromRehearsal(title.trim(), '预演方向', rehearsalTraceId)
    setTaskSaved(true)
  }

  function tryTonight() {
    const title = pickRehearsalTaskTitle(endData, summary)
    void saveTaskFromRehearsal(title.trim(), '沟通预演', rehearsalTraceId)
    setTonightSaved(true)
  }

  const insightBullets = briefLoading
    ? []
    : parseInsightBullets(childUnderstanding, []).filter(Boolean)
  const briefSubLine = selectedScene.mentionCountHint
    ? `${sceneTitle} · ${selectedScene.mentionCountHint}`
    : sceneTitle
  const childDisplayName = getChildDisplayName()

  return (
    <OnboardingGuard>
      <HiFiMainShell
        activeTab="rehearsal"
        showBottomNav={step !== 'active' && step !== 'end'}
        showInput={step === 'active'}
        inputZone={
          <HiFiInputZone
            busy={loading}
            placeholder="你想怎么接？输入你真实想说的话……"
            onSubmit={sendSimulationText}
          />
        }
      >
        <div className={`simulation-layout${step === 'entry' ? '' : ' hidden'}`} id="simulationEntry">
          <section className="section">
            <h1 className="page-heading" style={{ marginBottom: 16, lineHeight: 1.25 }}>
              选个场景
              <br />
              练怎么开口
            </h1>

            <button
              type="button"
              className="voice-hero-card"
              onClick={() => {
                document.getElementById('rehearsal-dialogue-capture')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <span className="voice-hero-eyebrow">真实对话 · 直接开口</span>
              <span className="voice-hero-title">亲子对话录音与分析</span>
              <span className="voice-hero-lede">
                录一段真实对话，转写后获得解读，并可带入情景预演。
              </span>
            </button>

            <div className="section-head-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="section-label">从对话里提出的痛点</span>
              <span className="hint-text" style={{ fontSize: 12 }}>
                {scenesLoading ? '整理中…' : rankedFromDialogue ? '按近期交流排序' : '可练场景'}
              </span>
            </div>

            <div className="scenario-grid" id="scenarioGrid">
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`scenario-card scene-card${selectedId === scene.id ? ' active' : ''}`}
                  onClick={() => openSceneBrief(scene.id)}
                >
                  <div className="scene-meta">
                    {scene.mentionCountHint ? (
                      <span className="scene-tag">{scene.mentionCountHint}</span>
                    ) : rankedFromDialogue ? (
                      <span className="scene-tag scene-tag--muted">可练场景</span>
                    ) : (
                      <span className="scene-tag scene-tag--muted">示例场景</span>
                    )}
                  </div>
                  <span className="scenario-title">{scene.title}</span>
                  <span className="scenario-desc">{scene.lede || scene.subtitle}</span>
                </button>
              ))}
              {scenesLoading && scenes.length <= REHEARSAL_SCENES.length ? (
                <p className="hint-text" style={{ padding: '12px 4px' }}>
                  正在刷新场景排序…
                </p>
              ) : null}
            </div>
          </section>

          <div className="simulation-start-actions">
            <button className="primary-button wide-button" type="button" onClick={startSimulation} disabled={briefLoading}>
              {briefLoading ? '正在整理场景…' : '开始预演'}
            </button>
            {lastDialogueAnalysisId ? (
              <button
                type="button"
                className="dialogue-resume-card"
                onClick={() =>
                  router.push(
                    `/rehearsal/dialogue-result?id=${encodeURIComponent(lastDialogueAnalysisId)}`
                  )
                }
              >
                <span className="dialogue-resume-card__title">查看上次对话分析</span>
                <span className="dialogue-resume-card__desc">
                  录音转写与解读已保存，可继续带入情景预演
                </span>
              </button>
            ) : null}
            <p className="boundary-note">
              这里不是预测孩子一定会这样说，而是基于已有记录，帮你提前看见可能的沟通走向。
            </p>
          </div>
        </div>

        <div className={`simulation-layout${step === 'confirm' ? '' : ' hidden'}`} id="simulationConfirm">
          <section className="section rehearsal-brief-layout">
            <button type="button" className="nav-back" onClick={() => setStep('entry')}>
              ← 返回选场景
            </button>
            <p className="brief-lede">这次先按这个痛点场景来练</p>
            <p className="brief-sub">{briefSubLine}</p>

            <article className="info-card">
              <p className="card-eyebrow">这个场景长什么样</p>
              <h3 className="info-card-title">场景摘要</h3>
              <p className="info-card-body" id="simulationSummary">
                {sceneSituation || summary}
              </p>
            </article>

            <article className="info-card">
              <p className="card-eyebrow">系统记忆 · 此场景下的孩子</p>
              <h3 className="info-card-title">我会参考这些理解</h3>
              {briefLoading ? (
                <p className="hint-text">正在模拟本场景下孩子的反应…</p>
              ) : insightBullets.length ? (
                <ul className="insight-list">
                  {insightBullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : (
                <p className="hint-text">暂时还没有足够记忆，先按场景摘要练一轮。</p>
              )}
            </article>

            <button className="primary-button wide-button" type="button" onClick={enterRehearsal}>
              进入预演
            </button>
          </section>
        </div>

        <div className={`simulation-layout rehearsal-dialogue-layout${step === 'active' ? '' : ' hidden'}`} id="simulationActive">
          <section className="section">
            <div className="rehearsal-header">
              <button type="button" className="nav-back nav-back--ink" onClick={() => setStep('confirm')}>
                ← 返回场景
              </button>
              <header className="dialogue-head">
                <h2 className="dialogue-title">和{childDisplayName}预演</h2>
                <p className="dialogue-sub">{sceneTitle}</p>
              </header>
            </div>
          </section>

          <section className="section">
            <div className="rehearsal-chat-thread simulation-feed" id="simulationFeed">
              {feed.map((item, index) => {
                if (item.type === 'parent') return <SimulationParentBubble key={index} text={item.text} />
                if (item.type === 'system_hint') {
                  return <SimulationSystemHintBubble key={index} text={item.text} />
                }
                if (item.type === 'thinking') {
                  return <SimulationThinkingBubble key={index} />
                }
                return (
                  <SimulationSecondMeBubble
                    key={index}
                    childText={item.childText}
                    hintTitle={item.hintTitle}
                    hintText={item.hintText}
                    suggestedTitle={item.suggestedTitle}
                    suggestedText={item.suggestedText}
                  />
                )
              })}
              <div ref={feedEndRef} />
            </div>
          </section>

          {showCheckpoint ? (
            <div className="rehearsal-checkpoint-backdrop" role="dialog" aria-modal="true">
              <div className="rehearsal-checkpoint-card">
                <h3>这轮预演可以先停在这里</h3>
                <p>你可以继续换说法练几轮，也可以结束并查看这次预演的总结。</p>
                <div className="rehearsal-checkpoint-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowCheckpoint(false)
                      setRoundsSinceCheckpoint(0)
                    }}
                  >
                    继续演练
                  </button>
                  <button type="button" className="primary-button" onClick={() => setStep('end')}>
                    结束演练
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className={`simulation-layout${step === 'end' ? '' : ' hidden'}`} id="simulationEnd">
          <RehearsalEndPanel
            endData={endData}
            taskSaved={taskSaved}
            tonightSaved={tonightSaved}
            onSaveDirection={saveDirection}
            onTryTonight={tryTonight}
            onRestart={restartSimulation}
          />
        </div>

        <div id="rehearsal-dialogue-capture">
          <RehearsalDialogueCapture />
        </div>
      </HiFiMainShell>
    </OnboardingGuard>
  )
}

function truncate(text: string, max = 72) {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}…`
}

function parseInsightBullets(text: string, fallback: string[]): string[] {
  const trimmed = text.trim()
  if (!trimmed) return fallback
  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^[-•·\d.)]+\s*/, '').trim())
    .filter((line) => line.length > 4)
  if (lines.length >= 2) return lines.slice(0, 5)
  const parts = trimmed
    .split(/[；;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 8)
  if (parts.length >= 2) return parts.slice(0, 5)
  return [trimmed]
}
