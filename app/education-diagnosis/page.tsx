'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { SpecialCollectionView } from '@/components/special/SpecialCollectionView'
import { LightFollowupView } from '@/components/special/LightFollowupView'
import type { FeatureUiMode } from '@/types/feature-ui'

/* ================================================================
   教育模式诊断（交付文档 5.3）——独立入口，单页状态机。
   按 API 返回的 uiMode 在 专项采集 / 轻追问 / 结果展示 三态间切换。
   ================================================================ */

type KeyTension = { title: string; detail: string }
type EduDiagData = {
  uiMode: FeatureUiMode
  acknowledgement: string
  missingInfo: string[]
  followupPrompt: string
  collectionGuide: string
  result: { modeReading: string; keyTensions: KeyTension[]; gentleNextStep: string } | null
}

// 「你可以这样讲」——教育诊断 7 类采集要素（文档 5.3.8），引导而非必填。
const GUIDES = [
  '普通上学日：放学后到睡前大概怎么过',
  '普通周末：补课、作业、出门、朋友、兴趣、休息怎么分布',
  '谁主要管学习，谁承接情绪',
  '孩子有没有一段真正属于自己、不被安排也不被临时加任务的时间',
  '完成任务后，他还会不会被继续追加任务',
  '学校压力、老师反馈、班级竞争大不大',
  '爸爸妈妈怎么分工，平时评价多不多',
]

export default function EducationDiagnosisPage() {
  const router = useRouter()
  const [mode, setMode] = useState<FeatureUiMode>('special_collection')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<EduDiagData | null>(null)
  const [turns, setTurns] = useState<string[]>([]) // 本会话已讲过的轮次，随提交透传给后端

  async function submit(text: string) {
    if (!text || loading) return
    setLoading(true)
    const priorTurns = turns
    setTurns([...turns, text])
    try {
      const res = await fetch('/api/education-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, priorTurns }),
      })
      const json = await res.json()
      if (json.ok && json.data) {
        setData(json.data as EduDiagData)
        setMode(json.data.uiMode as FeatureUiMode)
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="page">
        <PageHeader title="教育模式诊断" showBack onBack={() => router.push('/home')} />

        {mode === 'special_collection' ? (
          <SpecialCollectionView
            title="看清这个家每天怎么运转"
            subtitle="这不是判断你做得好不好，而是看日常和周末的结构。下面这些方向你可以随便讲，不用都讲完整。"
            inputGuides={GUIDES}
            placeholder="像讲生活流水一样多说一点，比如：他放学回来先吃点东西，六点开始写作业，我在旁边盯得比较多。周末上午补课，下午作业，晚上还要订正。主要是我管学习，他爸回来很晚……"
            primaryActionText="开始看看我们家的运转"
            loadingText="正在梳理你们家的日常结构…"
            loading={loading}
            extraGuide={data?.collectionGuide || undefined}
            onSubmit={submit}
          />
        ) : null}

        {mode === 'light_followup' && data ? (
          <LightFollowupView
            acknowledgement={data.acknowledgement}
            question={data.followupPrompt}
            missingInfo={data.missingInfo}
            loading={loading}
            onSubmit={submit}
          />
        ) : null}

        {mode === 'result_view' && data?.result ? (
          <div>
            {data.acknowledgement ? (
              <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', marginBottom: 14 }}>{data.acknowledgement}</div>
            ) : null}

            <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 16, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
              {data.result.modeReading ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>这个家大概怎么运转</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: '#1D1D1F', marginBottom: data.result.keyTensions.length ? 16 : 4 }}>{data.result.modeReading}</div>
                </>
              ) : null}

              {data.result.keyTensions.length > 0 ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>最该先看的张力（{data.result.keyTensions.length} 个）</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: data.result.gentleNextStep ? 16 : 4 }}>
                    {data.result.keyTensions.map((t, i) => (
                      <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 12, border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', marginBottom: 4 }}>{t.title}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: '#6E6E73' }}>{t.detail}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {data.result.gentleNextStep ? (
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#6E6E73' }}>{data.result.gentleNextStep}</div>
              ) : null}
            </div>

            {/* 结果之后回到轻追问：围绕结果继续问或补充（文档 5.3.2 轻互动态） */}
            <LightFollowupView
              acknowledgement=""
              question="想围绕上面的判断继续聊，或补一个我还没了解的情况？"
              loading={loading}
              onSubmit={submit}
            />
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
