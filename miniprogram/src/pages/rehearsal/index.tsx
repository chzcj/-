import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { HiFiInputZone } from '@/components/hifi/HiFiInputZone'
import { useTabBar } from '@/hooks/useTabBar'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { normalizeTaskTitle } from '@/lib/textDisplay'
import {
  SimulationParentBubble,
  SimulationSecondMeBubble,
  SimulationSystemHintBubble,
  SimulationThinkingBubble,
} from '@/components/rehearsal/SimulationBubbles'
import { REHEARSAL_SCENES, type RehearsalScene, type SimulationStep } from '@/data/rehearsalScenes'
import { mapAnalyzeToSecondMe, type RehearsalAnalyzeData } from '@/lib/rehearsalStream'
import { analyzeRehearsalTurn } from '@/services/rehearsalAnalyze'
import { apiRequest } from '@/services/api'
import { fetchCurrentUser } from '@/services/auth'
import { getLatestProfile } from '@/services/profileStorage'
import { saveTaskFromRehearsal } from '@/services/taskStorage'
import {
  clearRehearsalSession,
  loadLastDialogueAnalysisId,
  loadRehearsalSession,
  saveRehearsalSession,
  type RehearsalFeedItem,
} from '@/services/rehearsalSessionStorage'
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

type FeedItem = RehearsalFeedItem | { type: 'thinking' }

type RehearsalHandoff = {
  sceneId?: string
  seedText?: string
  parentText?: string
  rehearsalGoal?: string
  traceId?: string
}

function truncate(text: string, max = 72) {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}…`
}

function matchSceneFromText(text: string): RehearsalScene {
  const t = text || ''
  if (/手机/.test(t)) return REHEARSAL_SCENES.find((s) => s.id === 'phone') || REHEARSAL_SCENES[0]
  if (/吵|说重了|僵|修复|老师|学校|告状/.test(t))
    return REHEARSAL_SCENES.find((s) => s.id === 'after_conflict') || REHEARSAL_SCENES[0]
  return REHEARSAL_SCENES.find((s) => s.id === 'homework_start') || REHEARSAL_SCENES[0]
}

export default function RehearsalPage() {
  useTabBar('rehearsal')
  usePublicPageShare({
    title: '育见 · 沟通预演',
    path: SHARE_PATHS.rehearsal,
  })
  const [step, setStep] = useState<SimulationStep>('entry')
  const [scenes, setScenes] = useState<RehearsalScene[]>(REHEARSAL_SCENES)
  const [selectedId, setSelectedId] = useState(REHEARSAL_SCENES[0].id)
  const [summary, setSummary] = useState(REHEARSAL_SCENES[0].summary)
  const [sceneTitle, setSceneTitle] = useState(REHEARSAL_SCENES[0].title)
  const [statusText, setStatusText] = useState('当前状态：孩子有点烦，防御比较高')
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
  const [briefLoading, setBriefLoading] = useState(false)

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

  const applySceneSeed = useCallback((): boolean => {
    try {
      const dialogueCtx = Taro.getStorageSync(REHEARSAL_DIALOGUE_CONTEXT_KEY) as DialogueRehearsalContext | ''
      if (dialogueCtx && typeof dialogueCtx === 'object' && dialogueCtx.sceneSummary) {
        Taro.removeStorageSync(REHEARSAL_DIALOGUE_CONTEXT_KEY)
        const matched = matchSceneFromText(
          `${dialogueCtx.sceneTitle || ''} ${dialogueCtx.sceneSummary || ''}`
        )
        setSelectedId(matched.id)
        setSceneTitle(dialogueCtx.sceneTitle || matched.title)
        setSummary(dialogueCtx.sceneSummary)
        setSourceAnalysisId(dialogueCtx.sourceAnalysisId)
        setStep('confirm')
        return true
      }
      const handoff = Taro.getStorageSync(REHEARSAL_HANDOFF_KEY) as RehearsalHandoff | ''
      if (handoff && typeof handoff === 'object' && (handoff.seedText || handoff.sceneId)) {
        Taro.removeStorageSync(REHEARSAL_HANDOFF_KEY)
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
        setStep('confirm')
        return true
      }
      const seed = Taro.getStorageSync(REHEARSAL_SCENE_SEED_KEY)
      if (!seed) return false
      Taro.removeStorageSync(REHEARSAL_SCENE_SEED_KEY)
      const seedText = String(seed)
      const matched =
        scenes.find(
          (s) => s.title.includes(seedText) || s.seed === seedText || seedText.includes(s.title.slice(0, 2))
        ) || matchSceneFromText(seedText)
      setSelectedId(matched.id)
      setSummary(seedText.length > 40 ? seedText : matched.summary)
      setSceneTitle(matched.title)
      setStep('confirm')
      return true
    } catch {
      return false
    }
  }, [scenes])

  useEffect(() => {
    void (async () => {
      const res = await apiRequest<{ scenes?: RehearsalScene[] }>('/api/rehearsal/scenes')
      if (!res.ok || !res.data.scenes?.length) return
      const merged = REHEARSAL_SCENES.map((base) => {
        const patch = res.data.scenes!.find((s) => s.id === base.id)
        if (!patch) return base
        return {
          ...base,
          title: patch.title || base.title,
          subtitle: patch.lede || patch.subtitle || base.subtitle,
          lede: patch.lede || patch.subtitle || base.subtitle,
          mentionCountHint: patch.mentionCountHint,
          summary: patch.summary || base.summary,
          openingHint: patch.openingHint || base.openingHint,
        }
      })
      setScenes(merged)
    })()
  }, [])

  useDidShow(async () => {
    const user = await fetchCurrentUser()
    if (!requireOnboardingComplete(user)) return
    const seeded = applySceneSeed()
    if (!seeded) {
      const saved = loadRehearsalSession()
      if (saved && saved.step !== 'entry') {
        restoreRehearsalSession(saved)
        Taro.showToast({ title: '已恢复上次预演', icon: 'none', duration: 2000 })
      }
    }
    setLastDialogueAnalysisId(loadLastDialogueAnalysisId())
  })

  useEffect(() => {
    if (step === 'entry') return
    saveRehearsalSession({
      version: 1,
      savedAt: new Date().toISOString(),
      step,
      selectedId,
      summary,
      sceneTitle,
      statusText,
      feed: feed.filter((item): item is RehearsalFeedItem => item.type !== 'thinking'),
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

  useEffect(() => {
    if (step === 'active' || step === 'end') {
      void Taro.hideTabBar({ animation: true })
    } else {
      void Taro.showTabBar({ animation: true })
    }
  }, [step])

  const selectScenario = (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId)
    if (!scene) return
    setSelectedId(scene.id)
    setSceneTitle(scene.title)
    setSummary(scene.summary)
  }

  const startSimulation = async () => {
    setBriefLoading(true)
    setSummary(selectedScene.summary)
    try {
      const res = await apiRequest<{
        sceneSituation?: string
        childUnderstanding?: string
        openingHint?: string
      }>('/api/rehearsal/brief', {
        method: 'POST',
        body: { sceneId: selectedId },
      })
      if (res.ok) {
        setSceneSituation(res.data.sceneSituation || selectedScene.summary)
        setChildUnderstanding(res.data.childUnderstanding || '')
        if (res.data.openingHint) {
          setScenes((prev) =>
            prev.map((s) => (s.id === selectedId ? { ...s, openingHint: res.data.openingHint! } : s))
          )
        }
      } else {
        setSceneSituation(selectedScene.summary)
        setChildUnderstanding('')
      }
    } catch {
      setSceneSituation(selectedScene.summary)
      setChildUnderstanding('')
    } finally {
      setBriefLoading(false)
      setStep('confirm')
    }
  }

  const enterRehearsal = () => {
    let openingHint =
      selectedScene.openingHint || '他现在更像是在把你推开。'
    try {
      const dialogueCtx = Taro.getStorageSync(REHEARSAL_DIALOGUE_CONTEXT_KEY) as DialogueRehearsalContext | ''
      if (dialogueCtx && typeof dialogueCtx === 'object' && dialogueCtx.openingHint) {
        openingHint = dialogueCtx.openingHint
      }
    } catch {
      /* ignore */
    }
    setRound(0)
    setRoundsSinceCheckpoint(0)
    setShowCheckpoint(false)
    setEndData(null)
    setTaskSaved(false)
    setTonightSaved(false)
    setRehearsalTraceId(undefined)
    setStatusText('当前状态：孩子有点烦，防御比较高')
    setFeed([
      {
        type: 'child',
        childText: selectedScene.openingChild || '你别催我行不行，我又不是不写。',
        hintTitle: selectedScene.openingHintTitle || '他可能是这样听到的',
        hintText: openingHint,
      },
    ])
    setStep('active')
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

    setFeed((prev) => [...prev, { type: 'parent', text: value }, { type: 'thinking' }])
    setLoading(true)

    let childBubbleStarted = false
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
        setFeed((prev) => prev.filter((item) => item.type !== 'thinking'))
        if (!childBubbleStarted) {
          childBubbleStarted = true
          setFeed((prev) => [
            ...prev,
            {
              type: 'child',
              childText: reactionText,
              hintTitle: '他可能是这样听到的',
              hintText: '…',
            },
          ])
        } else {
          patchLastChild({ childText: reactionText })
        }
      },
      onFinal: (data) => {
        if (data.traceId) setRehearsalTraceId(data.traceId)
        const reply = mapAnalyzeToSecondMe(data)
        setEndData(data)
        setFeed((prev) => {
          const next = prev.filter((item) => item.type !== 'thinking')
          const childItem: Extract<FeedItem, { type: 'child' }> = {
            type: 'child',
            childText: reply.childText,
            hintTitle: reply.hintTitle,
            hintText: reply.hintText,
            suggestedTitle: reply.suggestedTitle,
            suggestedText: reply.suggestedText,
          }
          if (childBubbleStarted) {
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].type === 'child') {
                next[i] = childItem
                break
              }
            }
          } else {
            next.push(childItem)
          }
          return reply.dailyToneReminder
            ? [...next, { type: 'system_hint', text: reply.dailyToneReminder }]
            : next
        })
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
      },
      onError: (message) => {
        setFeed((prev) => [
          ...prev.filter((item) => item.type !== 'thinking'),
          {
            type: 'child',
            childText: '……（这次没有模拟出来，你可以换一句更轻的试试）',
            hintTitle: '预演暂时中断',
            hintText: message,
          },
        ])
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
          parentGoal: `在「${sceneTitle}」场景里把话说到孩子听得进去`,
        },
        rehearsalTranscript,
      }
    )

    setLoading(false)

    if (result.httpError && !result.data) {
      setFeed((prev) => [
        ...prev.filter((item) => item.type !== 'thinking'),
        {
          type: 'child',
          childText: '……（这次没有模拟出来）',
          hintTitle: '网络不太稳定',
          hintText: result.httpError || '请稍后再试',
        },
      ])
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
    const title = endData?.taskTitle || endData?.saferVersion || endData?.suggestedWording
    if (!title?.trim()) return
    const ok = await saveTaskFromRehearsal(normalizeTaskTitle(title), '预演方向', rehearsalTraceId)
    if (ok) {
      setTaskSaved(true)
      Taro.showToast({ title: '已保存', icon: 'success' })
    }
  }

  const tryTonight = async () => {
    const title = endData?.taskTitle || endData?.saferVersion || endData?.suggestedWording || summary
    const ok = await saveTaskFromRehearsal(normalizeTaskTitle(title), '沟通预演', rehearsalTraceId)
    if (ok) {
      setTonightSaved(true)
      Taro.showToast({ title: '已加入今晚任务', icon: 'success' })
    }
  }

  const profile = getLatestProfile()

  const confirmBullets = profile?.coreJudgment
    ? [
        truncate(profile.coreJudgment, 72),
        profile.supportFocus
          ? truncate(profile.supportFocus, 72)
          : '他对「被站在旁边盯着」比较敏感。',
        '他不一定是不想配合，更可能是对开始之后会被催、被改、被评价有防御。',
      ]
    : [
        '孩子最近几次冲突多发生在作业开始前。',
        '他对「被站在旁边盯着」比较敏感。',
        '他不一定是不想写，更可能是对「开始之后会被催、被检查、被评价」有防御。',
      ]

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
          <Text className='hero-title page-heading'>选个场景{'\n'}练怎么开口</Text>

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
            <Text className='section-head-meta muted'>高频场景</Text>
          </View>

          <View className='scenario-grid'>
            {scenes.map((scene) => (
              <View
                key={scene.id}
                className={`scenario-card scene-card${selectedId === scene.id ? ' active' : ''}`}
                onClick={() => selectScenario(scene.id)}
              >
                <View className='scene-meta'>
                  <Text className='scene-tag'>对话提取</Text>
                  {scene.mentionCountHint ? (
                    <Text className='scene-tag scene-tag--muted'>{scene.mentionCountHint}</Text>
                  ) : null}
                </View>
                <Text className='scenario-title'>{scene.title}</Text>
                <Text className='scenario-desc muted'>{scene.lede || scene.subtitle}</Text>
              </View>
            ))}
          </View>
          <Text className='pill primary wide-pill' onClick={() => void startSimulation()}>
            {briefLoading ? '正在整理场景…' : '开始预演'}
          </Text>

          {lastDialogueAnalysisId ? (
            <View
              className='dialogue-entry-card dialogue-entry-card--resume'
              onClick={() =>
                void Taro.navigateTo({
                  url: `/pages/rehearsal/dialogue-result/index?id=${encodeURIComponent(lastDialogueAnalysisId)}`,
                })
              }
            >
              <Text className='dialogue-entry-title'>查看上次对话分析</Text>
              <Text className='dialogue-entry-desc muted'>录音转写与解读已保存，可继续带入情景预演</Text>
            </View>
          ) : null}

          <View
            className='dialogue-entry-card dialogue-entry-card--compact'
            onClick={() => void Taro.navigateTo({ url: '/pages/rehearsal/dialogue/index' })}
          >
            <Text className='dialogue-entry-title'>进入对话录音</Text>
            <Text className='dialogue-entry-desc muted'>已有录音分析可带入场景</Text>
          </View>

          <Text className='boundary-note muted'>
            这里不是预测孩子一定会这样说，而是基于已有记录，帮你提前看见可能的沟通走向。
          </Text>
          <View id='rehearsal-entry-bottom' className='scroll-anchor' />
        </ScrollView>
      ) : null}

      {step === 'confirm' ? (
        <>
          <Text className='section-label back-link' onClick={() => { clearRehearsalSession(); setStep('entry') }}>
            ← 返回选场景
          </Text>
          <Text className='section-label'>这次先按这个场景来练</Text>
          <View className='hifi-card brief-card'>
            <Text className='section-label'>情景长什么样</Text>
            <Text className='brief-body'>{sceneSituation || summary}</Text>
          </View>
          <View className='hifi-card brief-card'>
            <Text className='section-label'>记忆里对孩子的理解</Text>
            <Text className='brief-body'>
              {childUnderstanding || confirmBullets.join(' ')}
            </Text>
          </View>
          <Text className='pill primary wide-pill' onClick={enterRehearsal}>
            进入预演
          </Text>
        </>
      ) : null}

      {step === 'active' ? (
        <View className='rehearsal-active-layout'>
          <View className='rehearsal-header'>
            <Text className='section-label back-link' onClick={() => setStep('confirm')}>
              ← 返回场景
            </Text>
            <Text className='hero-title page-heading'>沟通预演｜{sceneTitle}</Text>
            <Text className='muted'>{statusText}</Text>
          </View>
          <Text className='section-label'>预演对话</Text>
          <View className='rehearsal-scroll-wrap'>
            <ScrollView
              id='rehearsal-chat-scroll'
              className='chat-scroll-view'
              scrollY
              scrollWithAnimation
              enhanced
              showScrollbar={false}
            >
              <View className='chat-feed'>
                {feed.map((item, i) => {
                  if (item.type === 'parent') return <SimulationParentBubble key={i} text={item.text} />
                  if (item.type === 'system_hint') return <SimulationSystemHintBubble key={i} text={item.text} />
                  if (item.type === 'thinking') return <SimulationThinkingBubble key={i} />
                  return (
                    <SimulationSecondMeBubble
                      key={i}
                      childText={item.childText}
                      hintTitle={item.hintTitle}
                      hintText={item.hintText}
                      suggestedTitle={item.suggestedTitle}
                      suggestedText={item.suggestedText}
                    />
                  )
                })}
                <View id='rehearsal-chat-anchor' className='scroll-anchor' />
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
        <>
          <Text className='section-label'>这次预演里，我看到的重点</Text>
          <View className='hifi-card insight-card'>
            <Text className='section-label'>预演总结</Text>
            <Text>
              {endData?.closingAdvice ||
                endData?.whyThisIsSafer ||
                '先减少「被站在旁边看着」的感觉，再谈开始。'}
            </Text>
          </View>
          <View className='hifi-card result-block'>
            <Text className='section-label'>孩子最容易被触发的是</Text>
            <Text>
              {endData?.childLikelyHearing ||
                endData?.riskPoints?.[0] ||
                '当你解释「我是怕你拖到很晚」，或者说「你每次都拖」时，孩子容易听成：你还是在盯他、评价他。'}
            </Text>
          </View>
          <View className='hifi-card result-block'>
            <Text className='section-label'>今晚可以试的说法</Text>
            <Text>
              {endData?.saferVersion ||
                endData?.suggestedWording ||
                '今晚如果又卡在作业开始前，可以先让孩子自己选第一项，你暂时离开十分钟。'}
            </Text>
          </View>
          {endData?.avoidPhrases?.length ? (
            <View className='hifi-card result-block'>
              <Text className='section-label'>建议避免的说法</Text>
              <Text>{endData.avoidPhrases.slice(0, 3).join('；')}</Text>
            </View>
          ) : null}
          {endData?.likelyTriggeredMechanisms?.length ? (
            <View className='hifi-card result-block'>
              <Text className='section-label'>这句话容易触发的机制</Text>
              <Text>{endData.likelyTriggeredMechanisms.slice(0, 3).join('；')}</Text>
            </View>
          ) : null}
          {endData?.usedProfileEvidence?.length ? (
            <View className='hifi-card result-block'>
              <Text className='section-label'>这次分析用到的孩子画像依据</Text>
              <Text>{endData.usedProfileEvidence.slice(0, 3).join('；')}</Text>
            </View>
          ) : null}
          <View className='hifi-card result-block'>
            <Text className='section-label'>这次还不能直接进入档案的内容</Text>
            <Text>
              预演里的孩子反应只是模拟，不等于真实证据。只有你今晚真的试了，并反馈孩子实际怎么反应，才会更新档案。
            </Text>
          </View>
          <View className='end-actions'>
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
        </>
      ) : null}
    </HiFiMainShell>
  )
}
