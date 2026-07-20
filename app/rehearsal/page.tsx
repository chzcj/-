'use client'

import { useEffect, useRef, useState } from 'react'
import { HiFiInputZone } from '@/components/hifi/HiFiInputZone'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import {
  SimulationParentBubble,
  SimulationSecondMeBubble,
  SimulationSystemHintBubble,
} from '@/components/rehearsal/SimulationSecondMeBubble'
import type { RehearsalAnalyzeData } from '@/components/rehearsal/RehearsalOutput'
import { parseRehearsalStreamEvent } from '@/types/rehearsal-stream'
import {
  REHEARSAL_SCENES,
  type RehearsalScene,
} from '@/data/rehearsalScenes'
import { getLatestProfile } from '@/lib/storage/profileStorage'
import { saveTaskFromRehearsal } from '@/lib/storage/taskStorage'
import { RehearsalDialogueCapture } from '@/components/rehearsal/RehearsalDialogueCapture'
import { AuthorityInsightCard } from '@/components/hifi/AuthorityInsightCard'
import type { InputMode } from '@/types/childos'

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

  const hintTitle = '他可能是这样听到的'
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
  const [sceneSituation, setSceneSituation] = useState('')
  const [childUnderstanding, setChildUnderstanding] = useState('')
  const [briefLoading, setBriefLoading] = useState(false)
  const feedEndRef = useRef<HTMLDivElement>(null)

  const selectedScene: RehearsalScene =
    scenes.find((s) => s.id === selectedId) || scenes[0] || REHEARSAL_SCENES[0]

  function matchSceneFromText(raw: string): RehearsalScene {
    const t = raw || ''
    if (/手机/.test(t)) return scenes.find((s) => s.id === 'phone') || REHEARSAL_SCENES[0]
    if (/吵|说重了|僵|修复|老师|学校|告状/.test(t)) {
      return scenes.find((s) => s.id === 'after_conflict') || REHEARSAL_SCENES[0]
    }
    return scenes.find((s) => s.id === 'homework_start') || REHEARSAL_SCENES[0]
  }

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/rehearsal/scenes')
        const json = (await res.json()) as { ok?: boolean; data?: { scenes?: RehearsalScene[] } }
        if (!json.ok || !json.data?.scenes?.length) return
        const merged = REHEARSAL_SCENES.map((base) => {
          const patch = json.data!.scenes!.find((s) => s.id === base.id)
          if (!patch) return base
          return {
            ...base,
            title: patch.title || base.title,
            subtitle: patch.subtitle || patch.lede || base.subtitle,
            lede: patch.lede || patch.subtitle || base.lede,
            mentionCountHint: patch.mentionCountHint,
            summary: patch.summary || base.summary,
            openingHint: patch.openingHint || base.openingHint,
          }
        })
        setScenes(merged)
      } catch {
        /* keep static */
      }
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

  function selectScenario(scene: RehearsalScene) {
    setSelectedId(scene.id)
    setSceneTitle(scene.title)
    setSummary(scene.summary)
  }

  function startSimulation() {
    void (async () => {
      setBriefLoading(true)
      setSummary(selectedScene.summary)
      try {
        const res = await fetch('/api/rehearsal/brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sceneId: selectedId }),
        })
        const json = (await res.json()) as {
          ok?: boolean
          data?: {
            sceneSituation?: string
            childUnderstanding?: string
            openingHint?: string
          }
        }
        if (json.ok && json.data) {
          setSceneSituation(json.data.sceneSituation || selectedScene.summary)
          setChildUnderstanding(json.data.childUnderstanding || '')
          if (json.data.openingHint) {
            setScenes((prev) =>
              prev.map((s) =>
                s.id === selectedId ? { ...s, openingHint: json.data!.openingHint! } : s
              )
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
    })()
  }

  function enterRehearsal() {
    const scene = selectedScene
    setRound(0)
    setRoundsSinceCheckpoint(0)
    setShowCheckpoint(false)
    setEndData(null)
    setTaskSaved(false)
    setTonightSaved(false)
    setStatusText('当前状态：孩子有点烦，防御比较高')
    setFeed([
      {
        type: 'child',
        childText: scene.openingChild || '你别催我行不行，我又不是不写。',
        hintTitle: scene.openingHintTitle || '他可能是这样听到的',
        hintText:
          scene.openingHint ||
          '他现在不一定是在认真回答“什么时候写”，更像是在把你推开。',
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
    const title = endData?.taskTitle || endData?.saferVersion || endData?.suggestedWording
    if (!title?.trim()) return
    void saveTaskFromRehearsal(title.trim(), '预演方向', rehearsalTraceId)
    setTaskSaved(true)
  }

  function tryTonight() {
    const title = endData?.taskTitle || endData?.saferVersion || endData?.suggestedWording || summary
    void saveTaskFromRehearsal(title.trim(), '沟通预演', rehearsalTraceId)
    setTonightSaved(true)
  }

  const profile = getLatestProfile()
  const confirmBullets = profile?.coreJudgment
    ? [
        truncate(profile.coreJudgment, 72),
        profile.supportFocus ? truncate(profile.supportFocus, 72) : '他对“被站在旁边盯着”比较敏感。',
        '他不一定是不想配合，更可能是对开始之后会被催、被改、被评价有防御。',
      ]
    : [
        '孩子最近几次冲突多发生在作业开始前。',
        '他对“被站在旁边盯着”比较敏感。',
        '他不一定是不想写，更可能是对“开始之后会被催、被检查、被评价”有防御。',
      ]

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
                高频场景
              </span>
            </div>

            <div className="scenario-grid" id="scenarioGrid">
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`scenario-card scene-card${selectedId === scene.id ? ' active' : ''}`}
                  onClick={() => selectScenario(scene)}
                >
                  <div className="scene-meta">
                    <span className="scene-tag">对话提取</span>
                    {scene.mentionCountHint ? (
                      <span className="scene-tag scene-tag--muted">{scene.mentionCountHint}</span>
                    ) : null}
                  </div>
                  <span className="scenario-title">{scene.title}</span>
                  <span className="scenario-desc">{scene.lede || scene.subtitle}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="simulation-start-actions">
            <button className="primary-button wide-button" type="button" onClick={startSimulation} disabled={briefLoading}>
              {briefLoading ? '正在整理场景…' : '开始预演'}
            </button>
            <p className="boundary-note">
              这里不是预测孩子一定会这样说，而是基于已有记录，帮你提前看见可能的沟通走向。
            </p>
          </div>
        </div>

        <div className={`simulation-layout${step === 'confirm' ? '' : ' hidden'}`} id="simulationConfirm">
          <section className="section">
            <button type="button" className="quiet-button" onClick={() => setStep('entry')}>
              ← 返回选场景
            </button>
            <h2 className="section-title">这次先按这个场景来练</h2>
            <div className="profile-block brief-card">
              <h3>情景长什么样</h3>
              <p id="simulationSummary">{sceneSituation || summary}</p>
            </div>
          </section>

          <section className="section">
            <div className="profile-block brief-card">
              <h3>记忆里对孩子的理解</h3>
              <p>{childUnderstanding || confirmBullets.join(' ')}</p>
            </div>
          </section>

          <section className="section">
            <button className="primary-button wide-button" type="button" onClick={enterRehearsal}>
              进入预演
            </button>
          </section>
        </div>

        <div className={`simulation-layout${step === 'active' ? '' : ' hidden'}`} id="simulationActive">
          <section className="section">
            <div className="rehearsal-header">
              <h2 id="rehearsalTitle">沟通预演｜{sceneTitle}</h2>
              <p id="rehearsalStatus">{statusText}</p>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">预演对话</h2>
            <div className="simulation-feed" id="simulationFeed">
              {feed.map((item, index) => {
                if (item.type === 'parent') return <SimulationParentBubble key={index} text={item.text} />
                if (item.type === 'system_hint') {
                  return <SimulationSystemHintBubble key={index} text={item.text} />
                }
                if (item.type === 'thinking') {
                  return (
                    <div key={index} className="message-row ai">
                      <div className="bubble thinking-bubble">
                        <span className="thinking-dots" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    </div>
                  )
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
          <section className="section">
            <h2 className="section-title">这次预演里，我看到的重点</h2>
            <AuthorityInsightCard
              title="预演总结"
              body={
                endData?.closingAdvice ||
                endData?.whyThisIsSafer ||
                '先减少「被站在旁边看着」的感觉，再谈开始。'
              }
            />
            <div className="profile-block">
              <h3>孩子最容易被触发的是</h3>
              <p>
                {endData?.childLikelyHearing ||
                  endData?.riskPoints?.[0] ||
                  '当你解释“我是怕你拖到很晚”，或者说“你每次都拖”时，孩子容易听成：你还是在盯他、评价他。'}
              </p>
            </div>
            <div className="profile-block">
              <h3>今晚可以试的说法</h3>
              <p>
                {endData?.saferVersion ||
                  endData?.suggestedWording ||
                  '今晚如果又卡在作业开始前，可以先让孩子自己选第一项，你暂时离开十分钟。'}
              </p>
            </div>
            <div className="profile-block">
              <h3>4. 这次还不能直接进入档案的内容</h3>
              <p>
                预演里的孩子反应只是模拟，不等于真实证据。只有你今晚真的试了，并反馈孩子实际怎么反应，才会更新档案。
              </p>
            </div>
            <div className="end-actions">
              <button type="button" className="secondary-button" onClick={saveDirection} disabled={taskSaved}>
                {taskSaved ? '已保存' : '保存这个方向'}
              </button>
              <button type="button" className="primary-button" onClick={tryTonight} disabled={tonightSaved}>
                {tonightSaved ? '已加入今晚任务' : '今晚试一次'}
              </button>
              <button type="button" className="secondary-button" onClick={restartSimulation}>
                重新练一遍
              </button>
            </div>
          </section>
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
