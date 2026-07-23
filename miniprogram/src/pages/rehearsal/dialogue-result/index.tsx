import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { apiRequest } from '@/services/api'
import { writeLastDialogueAnalysisId } from '@/lib/rehearsalScenesCache'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { getChildDisplayName } from '@/services/childStorage'
import type { DialogueAnalysisPayload, DialogueAnalysisV2 } from '@yujian/contracts/rehearsal-dialogue'
import './index.scss'

function splitSceneLede(text: string): { headline: string; detail: string } | null {
  const trimmed = text.trim()
  const idx = trimmed.search(/[：:]/)
  if (idx <= 0 || idx >= trimmed.length - 1) return null
  const headline = trimmed.slice(0, idx).trim()
  const detail = trimmed.slice(idx + 1).trim()
  if (!headline || !detail) return null
  return { headline, detail }
}

/** 优先用带「总述：具体」结构的 summary；sceneLabel 多为短标签不含冒号 */
function pickSceneLedeText(summary?: string | null, sceneLabel?: string | null): string {
  const summaryText = (summary || '').trim()
  const labelText = (sceneLabel || '').trim()
  if (splitSceneLede(summaryText)) return summaryText
  if (splitSceneLede(labelText)) return labelText
  return summaryText || labelText
}

export default function DialogueResultPage() {
  useSafeShareAppMessage({ title: '育见 · 对话分析' })
  const router = useRouter()
  const id = router.params.id || ''
  const [data, setData] = useState<DialogueAnalysisPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const childCopy = childSystemCopy(getChildDisplayName())

  useEffect(() => {
    if (!id.startsWith('da_')) {
      setError('无效的分析链接')
      setLoading(false)
      return
    }
    void (async () => {
      const res = await apiRequest<DialogueAnalysisPayload>(
        `/api/rehearsal/dialogue-analyze?id=${encodeURIComponent(id)}`
      )
      setLoading(false)
      if (!res.ok) {
        setError(res.error.message || '加载失败')
        return
      }
      setData(res.data)
      writeLastDialogueAnalysisId(res.data.analysisId)
    })()
  }, [id])

  const goRehearsal = () => {
    try {
      if (data?.rehearsalSeed) {
        Taro.setStorageSync('childos_rehearsal_dialogue_context', data.rehearsalSeed)
      }
    } catch {
      /* ignore */
    }
    void Taro.switchTab({ url: '/pages/rehearsal/index' })
  }

  const goBackRehearsal = () => {
    void Taro.switchTab({ url: '/pages/rehearsal/index' })
  }

  const v2: DialogueAnalysisV2 | undefined = data?.v2
  const meta = v2?.meta
  const phaseCount = meta?.phaseCount ?? v2?.phases.length ?? 0
  const highlightCount =
    meta?.totalQuoteCount ?? v2?.phases.reduce((n, p) => n + p.quotes.length, 0) ?? 0

  return (
    <View className='dialogue-result-page'>
      <View className='app-safe-top' />
      <DeepPageHeader
        title='对话分析'
        showClose
        onBack={goBackRehearsal}
        onClose={goBackRehearsal}
      />

      <ScrollView scrollY className='dialogue-result-scroll' enhanced showScrollbar={false}>
        <View className='dialogue-result-inner'>
          {loading ? (
            <View className='dialogue-state-panel'>
              <View className='dialogue-loader' />
              <Text className='dialogue-state-title'>正在整理对话分析</Text>
              <Text className='dialogue-state-text'>育见正在听你们刚才说了什么…</Text>
            </View>
          ) : null}

          {error ? (
            <View className='dialogue-state-panel dialogue-state-panel--error'>
              <Text className='dialogue-state-title'>暂时没能打开结果</Text>
              <Text className='dialogue-state-text'>{error}</Text>
              <Text className='pill block' onClick={goBackRehearsal}>
                返回预演
              </Text>
            </View>
          ) : null}

          {data?.status === 'failed' ? (
            <View className='dialogue-state-panel dialogue-state-panel--error'>
              <Text className='dialogue-state-title'>分析没有完成</Text>
              <Text className='dialogue-state-text'>{data.errorMessage || '分析失败'}</Text>
              <Text className='pill block' onClick={goBackRehearsal}>
                返回预演
              </Text>
            </View>
          ) : null}

          {data?.status === 'insufficient' ? (
            <View className='dialogue-state-panel dialogue-state-panel--muted'>
              <Text className='dialogue-state-title'>这段录音还不够</Text>
              <Text className='dialogue-state-text'>
                {data.errorMessage ||
                  '这段录音里没有听到有效的亲子对话，下次真实交流时再录一段就好。'}
              </Text>
              <Text className='pill block' onClick={goBackRehearsal}>
                返回预演
              </Text>
            </View>
          ) : null}

          {data?.status === 'done' && v2 ? (
              <View className='da-result-flow'>
              {pickSceneLedeText(data.summary, meta?.sceneLabel) ? (() => {
                const sceneLedeText = pickSceneLedeText(data.summary, meta?.sceneLabel)
                const sceneLedeParts = splitSceneLede(sceneLedeText)
                return (
                  <View className='da-scene-lede'>
                    {sceneLedeParts ? (
                      <>
                        <Text className='da-scene-lede-headline'>{sceneLedeParts.headline}</Text>
                        <Text className='da-scene-lede-detail'>{sceneLedeParts.detail}</Text>
                      </>
                    ) : (
                      <Text className='da-scene-lede-text'>{sceneLedeText}</Text>
                    )}
                  </View>
                )
              })() : null}

              <View className='da-meta-row'>
                {meta?.sceneLabel && !splitSceneLede(pickSceneLedeText(data.summary, meta?.sceneLabel)) ? (
                  <Text className='da-meta-pill'>{meta.sceneLabel}</Text>
                ) : null}
                {meta?.durationHint ? <Text className='da-meta-pill'>{meta.durationHint}</Text> : null}
                <Text className='da-meta-pill da-meta-pill--accent'>
                  {phaseCount} 段 · 精选 {highlightCount} 句
                </Text>
              </View>

              <Text className='overview-kicker'>{childCopy.inSceneMemory}</Text>
              <View className='da-dossier-strip'>
                {v2.dossierCells.map((cell) => (
                  <View key={cell.label} className='da-dossier-cell'>
                    <Text className='da-dossier-label'>{cell.label}</Text>
                    <Text className='da-dossier-body'>{cell.body}</Text>
                  </View>
                ))}
              </View>

              <View className='da-synthesis'>
                <Text className='da-synthesis-title'>讲清</Text>
                <Text className='da-synthesis-body'>{v2.synthesis}</Text>
              </View>

              <Text className='da-rhythm-map-lede'>
                按对话节奏拆成 {phaseCount} 段，每段只留最亮的原话——读起来像「场景地图」，不是流水账转写。
              </Text>

              {v2.phases.map((phase) => (
                <View key={phase.title} className='da-phase-block'>
                  <View className='da-phase-head'>
                    <Text className='da-phase-title'>{phase.title}</Text>
                    {phase.quoteCountHint ? (
                      <Text className='da-meta-pill'>{phase.quoteCountHint}</Text>
                    ) : null}
                  </View>
                  <Text className='da-phase-profile'>{phase.profileMatch}</Text>
                  <View className='da-phase-quotes'>
                    {phase.quotes.map((q) => (
                      <Text key={`${phase.title}-${q.text.slice(0, 8)}`} className='da-phase-quote'>
                        <Text className='da-quote-speaker'>{q.speaker}：</Text>
                        <Text className='da-phase-quote-text'>「{q.text}」</Text>
                        {q.isPeak ? <Text className='da-trigger-tag'>峰值</Text> : null}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}

              <View className='da-action-block'>
                <Text className='da-action-block__badge'>今晚可试</Text>
                <Text className='da-action-block__lead'>拆成两步，照着做就行：</Text>
                {v2.tryTonightSteps.map((step) => (
                  <View key={step.label} className='da-step-item'>
                    <Text className='da-step-label'>{step.label}</Text>
                    <Text className='da-step-text'>{step.text}</Text>
                  </View>
                ))}
              </View>

              {v2.sampleLines.length ? (
                <View className='da-sample-card'>
                  <Text className='da-sample-card__title'>示范开口 · 完整一轮</Text>
                  {v2.sampleScene ? (
                    <Text className='da-sample-card__scene'>{v2.sampleScene}</Text>
                  ) : null}
                  <View className='da-sample-lines'>
                    {v2.sampleLines.map((line, i) => (
                      <Text key={i} className='da-sample-line'>
                        <Text
                          className={`da-sample-role${line.role === '家长' ? ' is-parent' : ''}`}
                        >
                          {line.role}
                        </Text>
                        {line.stageDirection ? `（${line.stageDirection}）` : ''}
                        {line.text}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : null}

              <View className='dialogue-result-actions'>
                <Text className='pill primary block' onClick={goRehearsal}>
                  用这次对话去情景预演
                </Text>
                <Text className='pill block' onClick={goBackRehearsal}>
                  返回预演
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}
