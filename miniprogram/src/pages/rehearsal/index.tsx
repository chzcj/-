import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { HiFiInputZone } from '@/components/hifi/HiFiInputZone'
import { useTabBar, hideRehearsalTabBar, showRehearsalTabBar } from '@/hooks/useTabBar'
import { useChatAutoScroll, CHAT_SCROLL_ANCHOR_A, CHAT_SCROLL_ANCHOR_B } from '@/hooks/useChatAutoScroll'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { normalizeTaskTitle } from '@/lib/textDisplay'
import {
  SimulationParentBubble,
  SimulationSecondMeBubble,
  SimulationSystemHintBubble,
} from '@/components/rehearsal/SimulationBubbles'
import { RehearsalGeneratingHint } from '@/components/rehearsal/RehearsalGeneratingHint'
import { REHEARSAL_SCENES, type RehearsalScene, type SimulationStep } from '@/data/rehearsalScenes'
import { mapAnalyzeToSecondMe, type RehearsalAnalyzeData } from '@/lib/rehearsalStream'
import { getRehearsalEndCopy, pickRehearsalTaskTitle } from '@yujian/contracts/rehearsal-end'
import {
  pickRehearsalL3Opening,
  type RehearsalSceneBriefL3,
} from '@yujian/contracts/rehearsal-scene-brief'
import { analyzeRehearsalTurn } from '@/services/rehearsalAnalyze'
import { apiRequest } from '@/services/api'
import { fetchCurrentUser } from '@/services/auth'
import { getLatestProfile } from '@/services/profileStorage'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { getChildDisplayName } from '@/services/childStorage'
import { saveTaskFromRehearsal } from '@/services/taskStorage'
import {
  clearRehearsalSession,
  loadLastDialogueAnalysisId,
  loadRehearsalSession,
  saveRehearsalSession,
  type RehearsalFeedItem,
} from '@/services/rehearsalSessionStorage'
import {
  readRehearsalScenesCache,
  writeRehearsalScenesCache,
} from '@/lib/rehearsalScenesCache'
import { requireOnboardingComplete } from '@/utils/navigation'
import './index.scss'

const CHECKPOINT_EVERY = 4
const REHEARSAL_SCENE_SEED_KEY = 'childos_rehearsal_scene_seed'
const REHEARSAL_DIALOGUE_CONTEXT_KEY = 'childos_rehearsal_dialogue_context'
const REHEARSAL_HANDOFF_KEY = 'childos_rehearsal_handoff'

type DialogueRehearsalContext = {
  sceneTitle?: string
  sceneSummary?: string
  openingHint?: string
  tryTonight?: string
  sampleDialogue?: string
  sourceAnalysisId?: string
}

type FeedItem = RehearsalFeedItem

type RehearsalHandoff = {
  sceneId?: string
  seedText?: string
  parentText?: string
  rehearsalGoal?: string
  traceId?: string
  retrievalPackDigest?: Record<string, unknown>
}

type BriefRequestCtx = {
  parentText?: string
  rehearsalGoal?: string
  retrievalPackDigest?: Record<string, unknown>
  /** 保留对话分析/handoff 带来的标题与摘要，不要被静态场景文案覆盖 */
  preserveSceneCopy?: boolean
  /** 带入上下文时的场景摘要兜底（避免 setState 未落盘时读到旧 summary） */
  fallbackSituation?: string
}

type SeedApplyResult =
  | { seeded: false }
  | { seeded: true; sceneId: string; briefCtx: BriefRequestCtx }

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

function matchSceneFromText(text: string, pool: RehearsalScene[]): RehearsalScene {
  const list = pool.length ? pool : REHEARSAL_SCENES
  const t = text || ''
  if (/手机|平板|游戏/.test(t)) return list.find((s) => s.id === 'phone') || list[0]
  if (/起床|出门|迟到|早上/.test(t)) return list.find((s) => s.id === 'morning') || list[0]
  if (/成绩|分数|考试|卷子/.test(t)) return list.find((s) => s.id === 'grades') || list[0]
  if (/吵|说重了|僵|修复|老师|学校|告状/.test(t))
    return list.find((s) => s.id === 'after_conflict') || list[0]
  return list.find((s) => s.id === 'homework_start') || list[0]
}

function mapApiScenes(patches: RehearsalScene[]): RehearsalScene[] {
  return patches.map((patch) => {
    const base = REHEARSAL_SCENES.find((s) => s.id === patch.id)
    return {
      id: patch.id,
      title: patch.title || base?.title || '练一句开口',
      subtitle: patch.lede || patch.subtitle || base?.subtitle || '',
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
}

function readInitialScenes(): {
  scenes: RehearsalScene[]
  rankedFromDialogue: boolean
} {
  const cached = readRehearsalScenesCache({ allowStale: true })
  if (cached?.scenes?.length) {
    return {
      scenes: cached.scenes,
      rankedFromDialogue: cached.rankedFromDialogue,
    }
  }
  return {
    scenes: REHEARSAL_SCENES,
    rankedFromDialogue: false,
  }
}

export default function RehearsalPage() {
  useTabBar('rehearsal')
  usePublicPageShare({
    title: '育见 · 沟通预演',
    path: SHARE_PATHS.rehearsal,
  })
  const [boot] = useState(() => readInitialScenes())
  const [step, setStep] = useState<SimulationStep>('entry')
  const [scenes, setScenes] = useState<RehearsalScene[]>(boot.scenes)
  const [rankedFromDialogue, setRankedFromDialogue] = useState(boot.rankedFromDialogue)
  const [selectedId, setSelectedId] = useState(boot.scenes[0]?.id || REHEARSAL_SCENES[0].id)
  const [summary, setSummary] = useState(boot.scenes[0]?.summary || REHEARSAL_SCENES[0].summary)
  const [sceneTitle, setSceneTitle] = useState(boot.scenes[0]?.title || REHEARSAL_SCENES[0].title)
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
  const [sourceAnalysisId, setSourceAnalysisId] = useState<string | undefined>()
  const [lastDialogueAnalysisId, setLastDialogueAnalysisId] = useState<string | null>(null)
  const [sceneSituation, setSceneSituation] = useState('')
  const [childUnderstanding, setChildUnderstanding] = useState('')
  const [sceneBrief, setSceneBrief] = useState<RehearsalSceneBriefL3 | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const briefRequestRef = useRef(0)
  const stepRef = useRef(step)
  const briefLoadingRef = useRef(briefLoading)
  stepRef.current = step
  briefLoadingRef.current = briefLoading

  const scrollFingerprint = useMemo(() => {
    const last = feed[feed.length - 1]
    const loadingFlag = loading ? 1 : 0
    if (!last) return `${feed.length}|${loadingFlag}`
    if (last.type === 'parent') return `${feed.length}|p|${last.text.length}|${loadingFlag}`
    if (last.type === 'child') {
      return `${feed.length}|c|${last.childText.length}|${last.hintText.length}|${last.hintPending ? 1 : 0}|${last.suggestedText?.length ?? 0}|${loadingFlag}`
    }
    if (last.type === 'system_hint') return `${feed.length}|hint|${last.text.length}|${loadingFlag}`
    return `${feed.length}|${loadingFlag}`
  }, [feed, loading])

  const { scrollIntoView, onScroll, scrollToBottom, resumeFollowOnSend, setViewHeight } =
    useChatAutoScroll([scrollFingerprint], { enabled: step === 'active' })

  useEffect(() => {
    if (step !== 'active') return
    const timer = setTimeout(() => {
      Taro.createSelectorQuery()
        .select('#rehearsal-chat-scroll')
        .boundingClientRect((rect) => {
          if (rect && !Array.isArray(rect) && rect.height) setViewHeight(rect.height)
        })
        .exec()
    }, 80)
    return () => clearTimeout(timer)
  }, [setViewHeight, feed.length, step])

  const selectedScene = scenes.find((s) => s.id === selectedId) || scenes[0] || REHEARSAL_SCENES[0]

  const restoreRehearsalSession = useCallback((saved: NonNullable<ReturnType<typeof loadRehearsalSession>>) => {
    setSelectedId(saved.selectedId)
    setSummary(saved.summary)
    setSceneTitle(saved.sceneTitle)
    setStatusText(saved.statusText)
    setFeed(saved.feed)
    setRound(saved.round)
    setRoundsSinceCheckpoint(saved.roundsSinceCheckpoint)
    setShowCheckpoint(saved.showCheckpoint)
    setEndData(saved.endData)
    setRehearsalTraceId(saved.rehearsalTraceId)
    setTaskSaved(saved.taskSaved)
    setTonightSaved(saved.tonightSaved)
    setSourceAnalysisId(saved.sourceAnalysisId)
    setStep(saved.step)
  }, [])

  const applySceneSeed = useCallback((): SeedApplyResult => {
    try {
      const dialogueCtx = Taro.getStorageSync(REHEARSAL_DIALOGUE_CONTEXT_KEY) as DialogueRehearsalContext | ''
      if (dialogueCtx && typeof dialogueCtx === 'object' && dialogueCtx.sceneSummary) {
        Taro.removeStorageSync(REHEARSAL_DIALOGUE_CONTEXT_KEY)
        try {
          Taro.removeStorageSync(REHEARSAL_SCENE_SEED_KEY)
          Taro.removeStorageSync(REHEARSAL_HANDOFF_KEY)
        } catch {
          /* ignore */
        }
        const matched = matchSceneFromText(
          `${dialogueCtx.sceneTitle || ''} ${dialogueCtx.sceneSummary || ''}`,
          scenes
        )
        const title = dialogueCtx.sceneTitle || matched.title
        const sceneSummary = dialogueCtx.sceneSummary
        const interimUnderstanding = [dialogueCtx.openingHint, dialogueCtx.tryTonight]
          .map((part) => String(part || '').trim())
          .filter(Boolean)
          .join('\n')
        setSelectedId(matched.id)
        setSceneTitle(title)
        setSummary(sceneSummary)
        setSceneSituation(sceneSummary)
        setChildUnderstanding(interimUnderstanding)
        setSceneBrief(null)
        setSourceAnalysisId(dialogueCtx.sourceAnalysisId)
        return {
          seeded: true,
          sceneId: matched.id,
          briefCtx: {
            parentText: sceneSummary,
            rehearsalGoal: dialogueCtx.tryTonight || dialogueCtx.openingHint || '围绕刚才的真实对话练开口',
            preserveSceneCopy: true,
            fallbackSituation: sceneSummary,
          },
        }
      }
      const handoff = Taro.getStorageSync(REHEARSAL_HANDOFF_KEY) as RehearsalHandoff | ''
      if (handoff && typeof handoff === 'object' && (handoff.seedText || handoff.sceneId)) {
        Taro.removeStorageSync(REHEARSAL_HANDOFF_KEY)
        try {
          Taro.removeStorageSync(REHEARSAL_SCENE_SEED_KEY)
        } catch {
          /* ignore */
        }
        const matched =
          scenes.find((s) => s.id === handoff.sceneId) ||
          matchSceneFromText(handoff.seedText || handoff.parentText || '', scenes)
        const nextSummary =
          [handoff.parentText, handoff.rehearsalGoal, handoff.seedText]
            .filter((part): part is string => Boolean(part?.trim()))
            .join('。')
            .slice(0, 800) || matched.summary
        setSelectedId(matched.id)
        setSceneTitle(matched.title)
        setSummary(nextSummary)
        setSceneSituation(nextSummary)
        setChildUnderstanding('')
        setSceneBrief(null)
        return {
          seeded: true,
          sceneId: matched.id,
          briefCtx: {
            parentText: handoff.parentText || handoff.seedText || nextSummary,
            rehearsalGoal: handoff.rehearsalGoal,
            retrievalPackDigest: handoff.retrievalPackDigest,
            preserveSceneCopy: true,
            fallbackSituation: nextSummary,
          },
        }
      }
      const seed = Taro.getStorageSync(REHEARSAL_SCENE_SEED_KEY)
      if (!seed) return { seeded: false }
      Taro.removeStorageSync(REHEARSAL_SCENE_SEED_KEY)
      const seedText = String(seed)
      const matched =
        scenes.find(
          (s) => s.title.includes(seedText) || s.seed === seedText || seedText.includes(s.title.slice(0, 2))
        ) || matchSceneFromText(seedText, scenes)
      const nextSummary = seedText.length > 40 ? seedText : matched.summary
      setSelectedId(matched.id)
      setSummary(nextSummary)
      setSceneTitle(matched.title)
      setSceneSituation(nextSummary)
      setChildUnderstanding('')
      setSceneBrief(null)
      return {
        seeded: true,
        sceneId: matched.id,
        briefCtx: {
          parentText: nextSummary,
          preserveSceneCopy: true,
          fallbackSituation: nextSummary,
        },
      }
    } catch {
      return { seeded: false }
    }
  }, [scenes])

  const refreshScenesSilently = useCallback(async () => {
    const res = await apiRequest<{
      scenes?: RehearsalScene[]
      rankedFromDialogue?: boolean
    }>('/api/rehearsal/scenes')
    if (!res.ok || !res.data.scenes?.length) return
    const next = mapApiScenes(res.data.scenes)
    const ranked = Boolean(res.data.rankedFromDialogue)
    setRankedFromDialogue(ranked)
    setScenes(next)
    writeRehearsalScenesCache(next, ranked)
    setSelectedId((prev) => {
      if (next.some((s) => s.id === prev)) return prev
      const first = next[0]
      if (first) {
        setSceneTitle(first.title)
        setSummary(first.summary)
        return first.id
      }
      return prev
    })
  }, [])

  useDidShow(async () => {
    const user = await fetchCurrentUser()
    if (!requireOnboardingComplete(user)) return
    // 每次进入预演 Tab：静默刷新场景，不打断当前列表
    void refreshScenesSilently()
    const seedResult = applySceneSeed()
    if (seedResult.seeded) {
      await openSceneBrief(seedResult.sceneId, seedResult.briefCtx)
    } else {
      const saved = loadRehearsalSession()
      const canResumeActive =
        saved?.step === 'active' && Array.isArray(saved.feed) && saved.feed.length > 0
      if (canResumeActive && saved) {
        restoreRehearsalSession(saved)
        Taro.showToast({ title: '已恢复上次预演', icon: 'none', duration: 2000 })
      } else {
        // Tab 默认首页 = 选个场景练；不自动跳进 confirm「正在整理场景」
        if (saved) clearRehearsalSession()
        if (
          !briefLoadingRef.current &&
          stepRef.current !== 'active' &&
          stepRef.current !== 'end'
        ) {
          briefRequestRef.current += 1
          setBriefLoading(false)
          setStep('entry')
        }
      }
    }
    let lastId = loadLastDialogueAnalysisId()
    if (!lastId) {
      const latest = await apiRequest<{ analysisId?: string | null }>(
        '/api/rehearsal/dialogue-analyze/latest'
      )
      if (latest.ok && latest.data.analysisId?.startsWith('da_')) {
        lastId = latest.data.analysisId
      }
    }
    setLastDialogueAnalysisId(lastId)
  })

  useEffect(() => {
    if (step === 'entry' || step === 'confirm') return
    saveRehearsalSession({
      version: 1,
      savedAt: new Date().toISOString(),
      step,
      selectedId,
      summary,
      sceneTitle,
      statusText,
      feed,
      round,
      roundsSinceCheckpoint,
      showCheckpoint,
      endData,
      rehearsalTraceId,
      taskSaved,
      tonightSaved,
      sourceAnalysisId,
    })
  }, [
    step,
    selectedId,
    summary,
    sceneTitle,
    statusText,
    feed,
    round,
    roundsSinceCheckpoint,
    showCheckpoint,
    endData,
    rehearsalTraceId,
    taskSaved,
    tonightSaved,
    sourceAnalysisId,
  ])

  const tabBarHiddenByUsRef = useRef(false)

  useEffect(() => {
    const shouldHide = step === 'active' || step === 'end'
    if (shouldHide) {
      hideRehearsalTabBar()
      tabBarHiddenByUsRef.current = true
      return
    }
    // entry/confirm：只有我们主动 hide 过才 show，避免一进预演就拉出原生文字栏
    if (tabBarHiddenByUsRef.current) {
      showRehearsalTabBar()
      tabBarHiddenByUsRef.current = false
    }
  }, [step])

  // 确认页只用 RehearsalGeneratingHint，禁止/清掉微信原生 showLoading 遮罩（含热更新残留）
  useEffect(() => {
    if (step !== 'confirm' && !briefLoading) return
    Taro.hideLoading()
  }, [step, briefLoading])

  const openSceneBrief = async (sceneId: string, ctx?: BriefRequestCtx) => {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return
    const requestId = ++briefRequestRef.current
    const fallbackSituation = ctx?.fallbackSituation || ctx?.parentText || scene.summary
    setBriefLoading(true)
    setStep('confirm')
    Taro.hideLoading()
    setSelectedId(scene.id)
    if (!ctx?.preserveSceneCopy) {
      setSceneTitle(scene.title)
      setSummary(scene.summary)
      setSceneSituation(scene.summary)
      setChildUnderstanding('')
      setSceneBrief(null)
    } else {
      setSceneSituation(fallbackSituation)
      setSceneBrief(null)
    }
    try {
      const res = await apiRequest<{
        sceneSituation?: string
        childUnderstanding?: string
        understandingBullets?: string[]
        openingHint?: string
        openingChild?: string
        openingHintTitle?: string
        initialStatusText?: string
      }>('/api/rehearsal/brief', {
        method: 'POST',
        timeout: 90000,
        data: {
          sceneId: scene.id,
          ...(ctx?.parentText ? { parentText: ctx.parentText } : {}),
          ...(ctx?.rehearsalGoal ? { rehearsalGoal: ctx.rehearsalGoal } : {}),
          ...(ctx?.retrievalPackDigest ? { retrievalPackDigest: ctx.retrievalPackDigest } : {}),
        },
      })
      if (requestId !== briefRequestRef.current) return
      if (res.ok) {
        const bullets = (res.data.understandingBullets || [])
          .map((b) => String(b || '').trim())
          .filter((b) => b.length > 4)
        setSceneSituation(res.data.sceneSituation || fallbackSituation)
        setChildUnderstanding(
          bullets.length >= 2
            ? bullets.join('\n')
            : res.data.childUnderstanding || ''
        )
        setSceneBrief({
          openingHint: res.data.openingHint || '',
          openingChild: res.data.openingChild || '',
          openingHintTitle: res.data.openingHintTitle || '他可能是这样想的',
          initialStatusText: res.data.initialStatusText || '',
        })
        if (res.data.openingHint || res.data.openingChild) {
          setScenes((prev) =>
            prev.map((s) =>
              s.id === scene.id
                ? {
                    ...s,
                    openingHint: res.data.openingHint || s.openingHint,
                    openingChild: res.data.openingChild || s.openingChild,
                    openingHintTitle: res.data.openingHintTitle || s.openingHintTitle,
                  }
                : s
            )
          )
        }
      } else if (!ctx?.preserveSceneCopy) {
        setSceneSituation(scene.summary)
        setChildUnderstanding('')
        setSceneBrief(null)
        Taro.showToast({ title: '场景整理未完成，可先按摘要练', icon: 'none', duration: 2200 })
      }
    } catch {
      if (requestId !== briefRequestRef.current) return
      if (!ctx?.preserveSceneCopy) {
        setSceneSituation(scene.summary)
        setChildUnderstanding('')
        setSceneBrief(null)
      }
      Taro.showToast({ title: '网络较慢，可先按摘要练', icon: 'none', duration: 2200 })
    } finally {
      if (requestId === briefRequestRef.current) {
        setBriefLoading(false)
        Taro.hideLoading()
      }
    }
  }

  const backToEntry = () => {
    briefRequestRef.current += 1
    setBriefLoading(false)
    Taro.hideLoading()
    clearRehearsalSession()
    setStep('entry')
  }

  const startSimulation = () => void openSceneBrief(selectedId)

  const enterRehearsal = () => {
    const firstUnderstanding = (childUnderstanding || sceneSituation || summary).split('\n')[0]?.trim()
    const l3 = pickRehearsalL3Opening(sceneBrief, selectedScene, firstUnderstanding)
    setRound(0)
    setRoundsSinceCheckpoint(0)
    setShowCheckpoint(false)
    setEndData(null)
    setTaskSaved(false)
    setTonightSaved(false)
    setRehearsalTraceId(undefined)
    if (l3.initialStatusText) setStatusText(l3.initialStatusText)
    setFeed([
      {
        type: 'child',
        childText: l3.openingChild,
        hintTitle: l3.openingHintTitle,
        hintText: l3.openingHint || firstUnderstanding || selectedScene.summary.slice(0, 80),
      },
    ])
    setStep('active')
    setTimeout(() => scrollToBottom(true), 80)
    setTimeout(() => scrollToBottom(true), 280)
  }

  const patchLastChild = (patch: Partial<Extract<FeedItem, { type: 'child' }>>) => {
    setFeed((prev) => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].type === 'child') {
          next[i] = { ...next[i], ...patch } as FeedItem
          break
        }
      }
      return next
    })
  }

  const runTurn = async (text: string) => {
    const value = text.trim()
    if (!value || loading || step !== 'active') return

    const pendingChild: Extract<FeedItem, { type: 'child' }> = {
      type: 'child',
      childText: '',
      hintTitle: '他可能是这样听到的',
      hintText: '',
      hintPending: true,
    }
    resumeFollowOnSend()
    setFeed((prev) => [...prev, { type: 'parent', text: value }, pendingChild])
    setLoading(true)
    setTimeout(() => scrollToBottom(true), 32)
    setTimeout(() => scrollToBottom(true), 120)
    setTimeout(() => scrollToBottom(true), 280)

    const parentText = `【预演场景：${sceneTitle}】\n场景摘要：${summary}\n家长说：${value}`

    const priorTurns = feed
      .filter((item): item is Extract<FeedItem, { type: 'parent' | 'child' }> =>
        item.type === 'parent' || item.type === 'child'
      )
      .map((item) =>
        item.type === 'parent'
          ? { role: 'parent' as const, text: item.text }
          : { role: 'child' as const, text: item.childText }
      )
      .slice(-10)
    const rehearsalTranscript = [...priorTurns, { role: 'parent' as const, text: value }]

    const profile = getLatestProfile()
    const result = await analyzeRehearsalTurn(
      parentText,
      round + 1,
      {
      onReactionDelta: (reactionText) => {
        patchLastChild({ childText: reactionText })
      },
      onFinal: (data) => {
        if (data.traceId) setRehearsalTraceId(data.traceId)
        const reply = mapAnalyzeToSecondMe(data)
        setEndData(data)
        setFeed((prev) => {
          const next = [...prev]
          const childItem: Extract<FeedItem, { type: 'child' }> = {
            type: 'child',
            childText: reply.childText,
            hintTitle: reply.hintTitle,
            hintText: reply.hintText,
            suggestedTitle: reply.suggestedTitle,
            suggestedText: reply.suggestedText,
          }
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].type === 'child') {
              next[i] = childItem
              break
            }
          }
          return reply.dailyToneReminder
            ? [...next, { type: 'system_hint', text: reply.dailyToneReminder }]
            : next
        })
        setStatusText(
          reply.hintTitle.includes('松动') || reply.hintTitle.includes('具体')
            ? childCopy.statusLoosen
            : childCopy.statusDefensive
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
      },
      onError: (message) => {
        patchLastChild({
          childText: '……（这次没有模拟出来，你可以换一句更轻的试试）',
          hintTitle: '预演暂时中断',
          hintText: message,
          hintPending: false,
        })
      },
      },
      {
        profileContext: profile
          ? {
              primaryConditionalProfile: [profile.coreJudgment, profile.deepMechanism]
                .filter(Boolean)
                .join('\n')
                .slice(0, 800),
              // supportFocus 是家长侧支持焦点，不当作孩子保护策略
              parentNarrativePattern: profile.supportFocus?.slice(0, 200),
              pendingHypotheses: (profile.verificationPoints || [])
                .map((p) => [p.title, p.description].filter(Boolean).join('：'))
                .filter(Boolean)
                .slice(0, 5),
              evidenceSnippets: (profile.evidence || [])
                .map((e) => e.evidenceText)
                .filter(Boolean)
                .slice(0, 5),
            }
          : undefined,
        rehearsalContext: {
          whatHappenedBeforeTalk: summary.slice(0, 200),
          sceneTitle,
          sceneSummary: summary.slice(0, 240),
          parentGoal: childCopy.speakInScene(sceneTitle),
        },
        rehearsalTranscript,
      }
    )

    setLoading(false)

    if (result.httpError && !result.data) {
      patchLastChild({
        childText: '……（这次没有模拟出来）',
        hintTitle: '网络不太稳定',
        hintText: result.httpError || '请稍后再试',
        hintPending: false,
      })
    }
  }

  const restartSimulation = () => {
    clearRehearsalSession()
    setSelectedId(scenes[0]?.id || REHEARSAL_SCENES[0].id)
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
    setSourceAnalysisId(undefined)
    setStep('entry')
  }

  const saveDirection = async () => {
    const title = pickRehearsalTaskTitle(endData)
    if (!title.trim()) return
    const ok = await saveTaskFromRehearsal(normalizeTaskTitle(title), '预演方向', rehearsalTraceId)
    if (ok) {
      setTaskSaved(true)
      Taro.showToast({ title: '已保存', icon: 'success' })
    }
  }

  const tryTonight = async () => {
    const title = pickRehearsalTaskTitle(endData, summary)
    const ok = await saveTaskFromRehearsal(normalizeTaskTitle(title), '沟通预演', rehearsalTraceId)
    if (ok) {
      setTonightSaved(true)
      Taro.showToast({ title: '已加入今晚任务', icon: 'success' })
    }
  }

  const profile = getLatestProfile()

  const insightBullets = briefLoading
    ? []
    : parseInsightBullets(childUnderstanding, []).filter(Boolean)
  const briefSubLine = selectedScene.mentionCountHint
    ? `${sceneTitle} · ${selectedScene.mentionCountHint}`
    : sceneTitle
  const childDisplayName = getChildDisplayName()
  const childCopy = childSystemCopy(childDisplayName)
  const endCopy = getRehearsalEndCopy(endData)

  return (
    <HiFiMainShell
      disableEntering
      withTabBar={step !== 'active' && step !== 'end'}
      showInput={step === 'active'}
      inputZone={
        <HiFiInputZone
          busy={loading}
          voiceMode='fill'
          placeholder='输入你想说的话'
          onSubmit={(t) => void runTurn(t)}
        />
      }
    >
      {step === 'entry' ? (
        <ScrollView
          id='rehearsal-entry-scroll'
          className='rehearsal-entry-scroll'
          scrollY
          scrollWithAnimation
          enhanced
          showScrollbar={false}
        >
          <Text className='hero-title page-heading'>选个场景练</Text>

          <View
            className='voice-hero'
            onClick={() => void Taro.navigateTo({ url: '/pages/rehearsal/dialogue/index' })}
          >
            <View className='voice-hero-top'>
              <View className='voice-hero-copy'>
                <Text className='voice-eyebrow'>真实对话 · 直接开口</Text>
                <Text className='voice-hero-title'>亲子对话录音与分析</Text>
                <Text className='voice-hero-lede muted'>
                  录一段真实对话，转写后获得解读，并可带入情景预演。
                </Text>
              </View>
            </View>
          </View>

          <View className='section-head-row'>
            <Text className='section-label'>从对话里提出的痛点</Text>
            <Text className='section-head-meta muted'>
              {rankedFromDialogue ? '按近期交流排序' : '可练场景'}
            </Text>
          </View>

          <View className='scenario-grid'>
            {scenes.map((scene) => (
              <View
                key={scene.id}
                className={`scenario-card scene-card${selectedId === scene.id ? ' active' : ''}`}
                onClick={() => {
                  setSelectedId(scene.id)
                  setSceneTitle(scene.title)
                  setSummary(scene.summary)
                }}
              >
                <View className='scene-meta'>
                  {scene.mentionCountHint ? (
                    <Text className='scene-tag'>{scene.mentionCountHint}</Text>
                  ) : rankedFromDialogue ? (
                    <Text className='scene-tag scene-tag--muted'>可练场景</Text>
                  ) : (
                    <Text className='scene-tag scene-tag--muted'>示例场景</Text>
                  )}
                </View>
                <Text className='scenario-title'>{scene.title}</Text>
                <Text className='scenario-desc muted'>{scene.lede || scene.subtitle}</Text>
              </View>
            ))}
          </View>
          <View className='pill primary wide-pill' hoverClass='none' onClick={() => void startSimulation()}>
            <Text className='wide-pill__label'>
              {briefLoading ? '正在整理场景…' : '开始预演'}
            </Text>
          </View>

          <View className={`rehearsal-footnote${lastDialogueAnalysisId ? ' has-action' : ''}`}>
            {lastDialogueAnalysisId ? (
              <View
                className='rehearsal-footnote__action'
                hoverClass='none'
                onClick={() =>
                  void Taro.navigateTo({
                    url: `/pages/rehearsal/dialogue-result/index?id=${encodeURIComponent(lastDialogueAnalysisId)}`,
                  })
                }
              >
                <View className='rehearsal-footnote__action-copy'>
                  <Text className='rehearsal-footnote__eyebrow'>录音分析</Text>
                  <Text className='rehearsal-footnote__title'>查看上次对话分析</Text>
                  <Text className='rehearsal-footnote__desc'>转写与解读已保存，可带入情景预演</Text>
                </View>
                <View className='rehearsal-footnote__chev' aria-hidden />
              </View>
            ) : null}
            <Text
              className={`rehearsal-footnote__note${lastDialogueAnalysisId ? ' is-divided' : ''}`}
            >
              {childCopy.rehearsalDisclaimer}
            </Text>
          </View>
          <View id='rehearsal-entry-bottom' className='scroll-anchor' />
        </ScrollView>
      ) : null}

      {step === 'confirm' ? (
        <View className='rehearsal-brief-layout'>
          <Text className='nav-back' onClick={backToEntry}>
            ← 返回选场景
          </Text>
          <Text className='brief-lede'>这次先按这个痛点场景来练</Text>
          <Text className='brief-sub muted'>{briefSubLine}</Text>

          {briefLoading ? (
            <View className='brief-loading-banner'>
              <RehearsalGeneratingHint />
            </View>
          ) : null}

          <View className='info-card'>
            <Text className='card-eyebrow'>这个场景长什么样</Text>
            <Text className='info-card-title'>场景摘要</Text>
            <Text className='info-card-body'>{sceneSituation || summary}</Text>
          </View>

          <View className='info-card'>
            <Text className='card-eyebrow'>{childCopy.inSceneMemory}</Text>
            <Text className='info-card-title'>我会参考这些理解</Text>
            {briefLoading ? (
              <View className='insight-skeleton'>
                <View className='insight-skeleton-line insight-skeleton-line--long' />
                <View className='insight-skeleton-line insight-skeleton-line--mid' />
                <View className='insight-skeleton-line insight-skeleton-line--short' />
              </View>
            ) : insightBullets.length ? (
              <View className='insight-list'>
                {insightBullets.map((bullet, index) => (
                  <Text key={index} className='insight-list-item'>
                    {bullet}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className='insight-loading muted'>暂时还没有足够记忆，先按场景摘要练一轮。</Text>
            )}
          </View>

          <View
            className={`pill primary wide-pill${briefLoading ? ' disabled' : ''}`}
            hoverClass='none'
            onClick={() => {
              if (briefLoading) return
              enterRehearsal()
            }}
          >
            <Text className='wide-pill__label'>
              {briefLoading ? '正在整理场景…' : '进入预演'}
            </Text>
          </View>
        </View>
      ) : null}

      {step === 'active' ? (
        <View className='rehearsal-active-layout rehearsal-dialogue-layout'>
          <View className='rehearsal-header'>
            <Text className='nav-back nav-back--ink' onClick={() => setStep('confirm')}>
              ← 返回场景
            </Text>
            <View className='dialogue-head'>
              <Text className='dialogue-title'>和{childDisplayName}预演</Text>
              <Text className='dialogue-sub muted'>{sceneTitle}</Text>
            </View>
          </View>
          <View className='rehearsal-scroll-wrap'>
            <ScrollView
              id='rehearsal-chat-scroll'
              className='chat-scroll-view'
              scrollY
              scrollWithAnimation
              scrollIntoView={scrollIntoView}
              onScroll={onScroll}
              enhanced
              showScrollbar={false}
            >
              <View className='rehearsal-chat-thread'>
                {feed.map((item, i) => {
                  if (item.type === 'parent') return <SimulationParentBubble key={i} text={item.text} />
                  if (item.type === 'system_hint') return <SimulationSystemHintBubble key={i} text={item.text} />
                  return (
                    <SimulationSecondMeBubble
                      key={i}
                      childText={item.childText}
                      hintTitle={item.hintTitle}
                      hintText={item.hintText}
                      hintPending={item.hintPending}
                      suggestedTitle={item.suggestedTitle}
                      suggestedText={item.suggestedText}
                    />
                  )
                })}
                <View id={CHAT_SCROLL_ANCHOR_A} className='scroll-anchor' />
                <View id={CHAT_SCROLL_ANCHOR_B} className='scroll-anchor' />
              </View>
            </ScrollView>
          </View>
          {showCheckpoint ? (
            <View className='checkpoint-backdrop'>
              <View className='checkpoint-card hifi-card'>
                <Text className='profile-card-title'>这轮预演可以先停在这里</Text>
                <Text className='muted'>你可以继续换说法练几轮，也可以结束并查看这次预演的总结。</Text>
                <View className='end-actions'>
                  <Text
                    className='pill'
                    onClick={() => {
                      setShowCheckpoint(false)
                      setRoundsSinceCheckpoint(0)
                    }}
                  >
                    继续演练
                  </Text>
                  <Text className='pill primary' onClick={() => setStep('end')}>
                    结束演练
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {step === 'end' ? (
        <ScrollView scrollY className='rehearsal-end-scroll' enhanced showScrollbar={false}>
          <View className='rehearsal-end-layout'>
            <View className='rehearsal-end-hero'>
              <Text className='profile-hero-kicker'>预演完成</Text>
              <Text className='rehearsal-end-heading'>这次预演里，我看到的重点</Text>
            </View>

            <View className='rehearsal-end-insight'>
              <Text className='rehearsal-end-insight-title'>预演总结</Text>
              <Text className='rehearsal-end-insight-body'>{endCopy.summary}</Text>
            </View>

            <View className='profile-block'>
              <Text className='profile-block-title'>{childCopy.triggerEasily}</Text>
              <Text className='profile-block-body'>{endCopy.trigger}</Text>
            </View>

            <View className='profile-block'>
              <Text className='profile-block-title'>今晚可以试的说法</Text>
              <Text className='profile-block-body'>{endCopy.tryTonight}</Text>
            </View>

            <View className='profile-block'>
              <Text className='profile-block-title'>还不能直接进入档案的内容</Text>
              <Text className='profile-block-body'>{endCopy.archiveNote}</Text>
            </View>

            <View className='end-actions rehearsal-end-actions'>
              <Text className={`pill${taskSaved ? ' disabled' : ''}`} onClick={() => void saveDirection()}>
                {taskSaved ? '已保存' : '保存这个方向'}
              </Text>
              <Text className={`pill primary${tonightSaved ? ' disabled' : ''}`} onClick={() => void tryTonight()}>
                {tonightSaved ? '已加入今晚任务' : '今晚试一次'}
              </Text>
              <Text className='pill' onClick={restartSimulation}>
                重新练一遍
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : null}
    </HiFiMainShell>
  )
}
