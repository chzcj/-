'use client'

import { useEffect, useRef, useState } from 'react'
import { HiFiInputZone } from '@/components/hifi/HiFiInputZone'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { OnboardingGuard } from '@/components/layout/OnboardingGuard'
import {
  SimulationParentBubble,
  SimulationSecondMeBubble,
} from '@/components/rehearsal/SimulationSecondMeBubble'
import type { RehearsalAnalyzeData } from '@/components/rehearsal/RehearsalOutput'
import {
  CUSTOM_SCENE,
  REHEARSAL_SCENES,
  type RehearsalScene,
} from '@/data/rehearsalScenes'
import { getLatestProfile } from '@/lib/storage/profileStorage'
import { saveTaskFromRehearsal } from '@/lib/storage/taskStorage'
import type { InputMode } from '@/types/childos'

type SimulationStep = 'entry' | 'confirm' | 'active' | 'end'

type FeedItem =
  | { type: 'parent'; text: string }
  | { type: 'child'; childText: string; hintTitle: string; hintText: string }
  | { type: 'thinking' }

function mapAnalyzeToSecondMe(data: RehearsalAnalyzeData) {
  const childText =
    data.possibleChildReaction?.immediateReaction ||
    (Array.isArray(data.childMayHear) ? data.childMayHear[0] : data.childMayHear) ||
    data.childLikelyHearing ||
    '……（孩子暂时没有接话）'

  const hintTitle = data.headline || '他可能是这样听到的'
  const hintText =
    data.possibleChildReaction?.innerReaction ||
    data.explanation ||
    data.whyThisIsSafer ||
    data.stuckPoint ||
    '可以继续换一句更轻的开口方式。'

  return { childText, hintTitle, hintText }
}

export default function RehearsalPage() {
  const [step, setStep] = useState<SimulationStep>('entry')
  const [selectedId, setSelectedId] = useState(REHEARSAL_SCENES[0].id)
  const [customText, setCustomText] = useState('')
  const [summary, setSummary] = useState(REHEARSAL_SCENES[0].summary)
  const [sceneTitle, setSceneTitle] = useState(REHEARSAL_SCENES[0].title)
  const [statusText, setStatusText] = useState('当前状态：孩子有点烦，防御比较高')
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [round, setRound] = useState(0)
  const [endData, setEndData] = useState<RehearsalAnalyzeData | null>(null)
  const [taskSaved, setTaskSaved] = useState(false)
  const [rehearsalTraceId, setRehearsalTraceId] = useState<string | undefined>()
  const feedEndRef = useRef<HTMLDivElement>(null)

  const selectedScene: RehearsalScene =
    selectedId === CUSTOM_SCENE.id
      ? { ...CUSTOM_SCENE, summary: customText.trim() || CUSTOM_SCENE.summary }
      : REHEARSAL_SCENES.find((s) => s.id === selectedId) || REHEARSAL_SCENES[0]

  useEffect(() => {
    try {
      const seed = sessionStorage.getItem('childos_rehearsal_scene_seed')
      if (!seed) return
      sessionStorage.removeItem('childos_rehearsal_scene_seed')
      const matched = REHEARSAL_SCENES.find(
        (s) => s.title.includes(seed) || s.seed === seed || seed.includes(s.title.slice(0, 2))
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

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [feed, loading, step])

  function selectScenario(scene: RehearsalScene) {
    setSelectedId(scene.id)
    if (scene.id === CUSTOM_SCENE.id) {
      setSceneTitle(CUSTOM_SCENE.title)
      setSummary(customText.trim() || CUSTOM_SCENE.summary)
    } else {
      setSceneTitle(scene.title)
      setSummary(scene.summary)
    }
  }

  function startSimulation() {
    const nextSummary =
      selectedId === CUSTOM_SCENE.id
        ? customText.trim() || CUSTOM_SCENE.summary
        : selectedScene.summary
    setSummary(nextSummary)
    setStep('confirm')
  }

  function enterRehearsal() {
    const scene = selectedScene
    setRound(0)
    setEndData(null)
    setTaskSaved(false)
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
        }),
      })
      const json = await res.json()
      setFeed((prev) => prev.filter((item) => item.type !== 'thinking'))

      if (json.ok && json.data) {
        const data = json.data as RehearsalAnalyzeData & { traceId?: string }
        if (data.traceId) setRehearsalTraceId(data.traceId)
        const reply = mapAnalyzeToSecondMe(data)
        setEndData(data)
        setFeed((prev) => [...prev, { type: 'child', ...reply }])
        setStatusText(
          reply.hintTitle.includes('松动') || reply.hintTitle.includes('具体')
            ? '当前状态：孩子开始谈条件，有一点松动'
            : '当前状态：孩子仍有防御，需要先降压力'
        )
        setRound((r) => {
          const next = r + 1
          if (next >= 4) {
            window.setTimeout(() => setStep('end'), 700)
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
    setCustomText('')
    setSelectedId(REHEARSAL_SCENES[0].id)
    setSummary(REHEARSAL_SCENES[0].summary)
    setSceneTitle(REHEARSAL_SCENES[0].title)
    setFeed([])
    setEndData(null)
    setTaskSaved(false)
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
    setTaskSaved(true)
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
            <div className="scenario-grid" id="scenarioGrid">
              {REHEARSAL_SCENES.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  className={`scenario-card${selectedId === scene.id ? ' active' : ''}`}
                  onClick={() => selectScenario(scene)}
                >
                  <span className="scenario-title">{scene.title}</span>
                  <span className="scenario-desc">{scene.subtitle}</span>
                </button>
              ))}
              <div
                className={`scenario-card custom-scenario${selectedId === CUSTOM_SCENE.id ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => selectScenario(CUSTOM_SCENE)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') selectScenario(CUSTOM_SCENE)
                }}
              >
                <span className="scenario-title">{CUSTOM_SCENE.title}</span>
                <span className="scenario-desc">{CUSTOM_SCENE.subtitle}</span>
                <textarea
                  className="custom-scene-input"
                  id="simulationSceneInput"
                  rows={3}
                  placeholder={CUSTOM_SCENE.placeholder}
                  value={customText}
                  onChange={(e) => {
                    setCustomText(e.target.value)
                    if (selectedId === CUSTOM_SCENE.id) {
                      setSummary(e.target.value.trim() || CUSTOM_SCENE.summary)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </section>

          <div className="simulation-start-actions">
            <button className="primary-button wide-button" type="button" onClick={startSimulation}>
              开始预演
            </button>
            <p className="boundary-note">
              这里不是预测孩子一定会这样说，而是基于已有记录，帮你提前看见可能的沟通走向。
            </p>
          </div>
        </div>

        <div className={`simulation-layout${step === 'confirm' ? '' : ' hidden'}`} id="simulationConfirm">
          <section className="section">
            <h2 className="section-title">这次先按这个场景来练</h2>
            <div className="profile-block">
              <h3>场景摘要：</h3>
              <p id="simulationSummary">{summary}</p>
            </div>
          </section>

          <section className="section">
            <div className="profile-block">
              <h3>我会参考这些理解：</h3>
              <ul>
                {confirmBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="section">
            <div className="profile-block">
              <h3>开始前提醒：</h3>
              <p>你不用选标准答案。你每一轮都用自己的话输入，我来模拟孩子可能怎么接。</p>
            </div>
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
                  />
                )
              })}
              <div ref={feedEndRef} />
            </div>
          </section>
        </div>

        <div className={`simulation-layout${step === 'end' ? '' : ' hidden'}`} id="simulationEnd">
          <section className="section">
            <h2 className="section-title">这次预演里，我看到的重点</h2>
            <div className="profile-block">
              <h3>1. 孩子最容易被触发的是</h3>
              <p>
                {endData?.childLikelyHearing ||
                  endData?.riskPoints?.[0] ||
                  '当你解释“我是怕你拖到很晚”，或者说“你每次都拖”时，孩子容易听成：你还是在盯他、评价他。'}
              </p>
            </div>
            <div className="profile-block">
              <h3>2. 这次比较有用的方向是</h3>
              <p>{endData?.whyThisIsSafer || endData?.saferVersion || '先减少“被站在旁边看着”的感觉，再谈开始。'}</p>
            </div>
            <div className="profile-block">
              <h3>3. 现实里可以试的不是一句话，而是一段做法</h3>
              <p>
                {endData?.suggestedWording ||
                  endData?.saferVersion ||
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
              <button type="button" className="secondary-button" onClick={tryTonight} disabled={taskSaved}>
                今晚试一次
              </button>
              <button type="button" className="primary-button" onClick={restartSimulation}>
                重新练一遍
              </button>
            </div>
          </section>
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
