import { View, Text, Textarea } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { RehearsalDialogueCapture } from '@/components/rehearsal/RehearsalDialogueCapture'
import { HiFiInputZone } from '@/components/hifi/HiFiInputZone'
import { useTabBar } from '@/hooks/useTabBar'
import {
  SimulationParentBubble,
  SimulationSecondMeBubble,
  SimulationSystemHintBubble,
  SimulationThinkingBubble,
} from '@/components/rehearsal/SimulationBubbles'
import { REHEARSAL_SCENES, CUSTOM_SCENE, type SimulationStep } from '@/data/rehearsalScenes'
import { mapAnalyzeToSecondMe, type RehearsalAnalyzeData } from '@/lib/rehearsalStream'
import { analyzeRehearsalTurn } from '@/services/rehearsalAnalyze'
import { fetchCurrentUser } from '@/services/auth'
import { getLatestProfile } from '@/services/profileStorage'
import { saveTaskFromRehearsal } from '@/services/taskStorage'
import { requireOnboardingComplete } from '@/utils/navigation'
import './index.scss'

const CHECKPOINT_EVERY = 4
const REHEARSAL_SCENE_SEED_KEY = 'childos_rehearsal_scene_seed'

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

function truncate(text: string, max = 72) {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}…`
}

export default function RehearsalPage() {
  useTabBar('rehearsal')
  const [step, setStep] = useState<SimulationStep>('entry')
  const [selectedId, setSelectedId] = useState(REHEARSAL_SCENES[0].id)
  const [customText, setCustomText] = useState('')
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

  const selectedScene =
    selectedId === CUSTOM_SCENE.id
      ? { ...CUSTOM_SCENE, summary: customText.trim() || CUSTOM_SCENE.summary }
      : REHEARSAL_SCENES.find((s) => s.id === selectedId) || REHEARSAL_SCENES[0]

  const applySceneSeed = useCallback(() => {
    try {
      const seed = Taro.getStorageSync(REHEARSAL_SCENE_SEED_KEY)
      if (!seed) return
      Taro.removeStorageSync(REHEARSAL_SCENE_SEED_KEY)
      const seedText = String(seed)
      const matched = REHEARSAL_SCENES.find(
        (s) => s.title.includes(seedText) || s.seed === seedText || seedText.includes(s.title.slice(0, 2))
      )
      if (matched) {
        setSelectedId(matched.id)
        setSummary(matched.summary)
        setSceneTitle(matched.title)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useDidShow(async () => {
    const user = await fetchCurrentUser()
    if (!requireOnboardingComplete(user)) return
    applySceneSeed()
  })

  const selectScenario = (sceneId: string) => {
    if (sceneId === CUSTOM_SCENE.id) {
      setSelectedId(CUSTOM_SCENE.id)
      setSceneTitle(CUSTOM_SCENE.title)
      setSummary(customText.trim() || CUSTOM_SCENE.summary)
      return
    }
    const scene = REHEARSAL_SCENES.find((s) => s.id === sceneId)
    if (!scene) return
    setSelectedId(scene.id)
    setSceneTitle(scene.title)
    setSummary(scene.summary)
  }

  const startSimulation = () => {
    const nextSummary =
      selectedId === CUSTOM_SCENE.id ? customText.trim() || CUSTOM_SCENE.summary : selectedScene.summary
    setSummary(nextSummary)
    setStep('confirm')
  }

  const enterRehearsal = () => {
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
        hintText:
          selectedScene.openingHint || '他现在更像是在把你推开。',
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

    const result = await analyzeRehearsalTurn(parentText, round + 1, {
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
    })

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
    setCustomText('')
    setSelectedId(REHEARSAL_SCENES[0].id)
    setSummary(REHEARSAL_SCENES[0].summary)
    setSceneTitle(REHEARSAL_SCENES[0].title)
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

  const saveDirection = async () => {
    const title = endData?.taskTitle || endData?.saferVersion || endData?.suggestedWording
    if (!title?.trim()) return
    const ok = await saveTaskFromRehearsal(title.trim(), '预演方向', rehearsalTraceId)
    if (ok) {
      setTaskSaved(true)
      Taro.showToast({ title: '已保存', icon: 'success' })
    }
  }

  const tryTonight = async () => {
    const title = endData?.taskTitle || endData?.saferVersion || endData?.suggestedWording || summary
    const ok = await saveTaskFromRehearsal(title.trim(), '沟通预演', rehearsalTraceId)
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
      showInput={step === 'active'}
      inputZone={
        <HiFiInputZone
          busy={loading}
          placeholder='你想怎么接？输入你真实想说的话……'
          onSubmit={(t) => void runTurn(t)}
        />
      }
    >
      {step === 'entry' ? (
        <>
          <Text className='hero-title page-heading'>选个场景，练怎么开口</Text>
          <View className='scenario-grid'>
            {REHEARSAL_SCENES.map((scene) => (
              <View
                key={scene.id}
                className={`scenario-card${selectedId === scene.id ? ' active' : ''}`}
                onClick={() => selectScenario(scene.id)}
              >
                <Text className='scenario-title'>{scene.title}</Text>
                <Text className='scenario-desc muted'>{scene.subtitle}</Text>
              </View>
            ))}
            <View
              className={`scenario-card custom-scenario${selectedId === CUSTOM_SCENE.id ? ' active' : ''}`}
              onClick={() => selectScenario(CUSTOM_SCENE.id)}
            >
              <Text className='scenario-title'>{CUSTOM_SCENE.title}</Text>
              <Text className='scenario-desc muted'>{CUSTOM_SCENE.subtitle}</Text>
              <Textarea
                className='rehearsal-textarea'
                value={customText}
                placeholder={CUSTOM_SCENE.placeholder}
                onInput={(e) => {
                  setCustomText(e.detail.value)
                  if (selectedId === CUSTOM_SCENE.id) {
                    setSummary(e.detail.value.trim() || CUSTOM_SCENE.summary)
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </View>
          </View>
          <Text className='pill primary wide-pill' onClick={startSimulation}>
            开始预演
          </Text>
          <Text className='boundary-note muted'>
            这里不是预测孩子一定会这样说，而是基于已有记录，帮你提前看见可能的沟通走向。
          </Text>
        </>
      ) : null}

      {step === 'confirm' ? (
        <>
          <Text className='section-label'>这次先按这个场景来练</Text>
          <View className='hifi-card'>
            <Text className='section-label'>场景摘要</Text>
            <Text>{summary}</Text>
          </View>
          <View className='hifi-card'>
            <Text className='section-label'>我会参考这些理解</Text>
            {confirmBullets.map((item) => (
              <Text key={item} className='bullet-item'>
                · {item}
              </Text>
            ))}
          </View>
          <View className='hifi-card'>
            <Text className='section-label'>开始前提醒</Text>
            <Text>你不用选标准答案。你每一轮都用自己的话输入，我来模拟孩子可能怎么接。</Text>
          </View>
          <Text className='pill primary wide-pill' onClick={enterRehearsal}>
            进入预演
          </Text>
        </>
      ) : null}

      {step === 'active' ? (
        <>
          <View className='rehearsal-header'>
            <Text className='hero-title page-heading'>沟通预演｜{sceneTitle}</Text>
            <Text className='muted'>{statusText}</Text>
          </View>
          <Text className='section-label'>预演对话</Text>
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
        </>
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

      <RehearsalDialogueCapture />
    </HiFiMainShell>
  )
}
