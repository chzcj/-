'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { SpecialCollectionView } from '@/components/special/SpecialCollectionView'
import { apiClient } from '@/lib/api-client'

/* ================================================================
   材料理解（交付文档 2 / 8.1 MaterialUnderstandingAgent）——独立专项入口。
   家长贴入材料文本（老师反馈/作业/录音转写/截图文字）→ 前台给家长可读解读，
   后台把材料抽成事实并标 material_observation 写入记忆。
   状态机：special_collection（采集）→ result_view（解读）。材料是「贴进来即读」，不做渐进追问。
   ================================================================ */

type MaterialTypeKey = 'teacher_feedback' | 'homework' | 'transcript' | 'screenshot_text' | 'other'

const MATERIAL_TYPES: Array<{ key: MaterialTypeKey; label: string }> = [
  { key: 'teacher_feedback', label: '老师反馈' },
  { key: 'homework', label: '作业' },
  { key: 'transcript', label: '录音转写' },
  { key: 'screenshot_text', label: '截图文字' },
  { key: 'other', label: '其他' },
]

// 「你可以这样贴」——引导家长贴什么，非必填。
const GUIDES = [
  '老师在群里或面谈时对孩子的评语',
  '一道作业题、孩子的解答或老师的批改',
  '和孩子一段对话的录音转写',
  '截图里和孩子有关的文字',
]

type MaterialResult = { reading: string; keyPoints: string[] }

export default function MaterialUnderstandingPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'special_collection' | 'result_view'>('special_collection')
  const [materialType, setMaterialType] = useState<MaterialTypeKey>('other')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MaterialResult | null>(null)
  const [error, setError] = useState('')

  async function submit(text: string) {
    if (!text || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.analyzeMaterial({ materialText: text, materialType })
      if (res.ok) {
        setData({ reading: res.data.reading, keyPoints: res.data.keyPoints || [] })
        setMode('result_view')
      } else {
        setError(res.error.message || '这份材料没能读取成功，可以稍后再试。')
      }
    } catch {
      setError('这份材料没能读取成功，可以稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  function readAnother() {
    setData(null)
    setError('')
    setMode('special_collection')
  }

  return (
    <AppShell>
      <div className="page">
        <PageHeader title="材料理解" showBack onBack={() => router.push('/home')} />
        {error ? <div className="toast">{error}</div> : null}

        {mode === 'special_collection' ? (
          <>
            {/* 材料类型选择：帮系统更贴近这份材料的来源（老师反馈反映学校场景、作业反映具体题目等） */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {MATERIAL_TYPES.map((t) => {
                const active = t.key === materialType
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setMaterialType(t.key)}
                    aria-pressed={active}
                    aria-label={`材料类型：${t.label}${active ? '（已选）' : ''}`}
                    style={{
                      fontSize: 13,
                      padding: '6px 14px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      color: active ? '#fff' : '#6E6AF8',
                      background: active ? '#6E6AF8' : 'rgba(110,106,248,0.06)',
                      border: `1px solid ${active ? '#6E6AF8' : 'rgba(110,106,248,0.16)'}`,
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>

            <SpecialCollectionView
              title="把材料里的事实和评价分开看"
              subtitle="把老师反馈、作业、录音转写或截图里的文字贴进来，我帮你看看这份材料透露了什么——哪些是客观事实、哪些是评价。材料只作为线索，不替你给孩子下定论。"
              inputGuides={GUIDES}
              placeholder="把材料里的文字贴进来，比如老师的评语：「这周上课比较走神，作业完成不够认真，希望家长多关注。」也可以直接说一说。"
              primaryActionText="看看这份材料"
              loadingText="正在读这份材料…"
              loading={loading}
              onSubmit={submit}
            />
          </>
        ) : null}

        {mode === 'result_view' && data ? (
          <div>
            <div className="card" style={{ padding: 18, borderRadius: 22, marginBottom: 16, background: 'rgba(110,106,248,0.04)', border: '1px solid rgba(110,106,248,0.10)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 6 }}>这份材料能看出什么</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: '#1D1D1F', marginBottom: data.keyPoints.length ? 16 : 4 }}>{data.reading}</div>

              {data.keyPoints.length > 0 ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6E6AF8', marginBottom: 8 }}>值得留意的线索</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.keyPoints.map((p, i) => (
                      <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 12, border: '1px solid rgba(0,0,0,0.05)', fontSize: 13, lineHeight: 1.6, color: '#1D1D1F' }}>
                        {p}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <button
              type="button"
              onClick={readAnother}
              style={{ width: '100%', padding: '13px 0', fontSize: 15, fontWeight: 600, color: '#6E6AF8', background: 'rgba(110,106,248,0.06)', border: '1px solid rgba(110,106,248,0.16)', borderRadius: 14, cursor: 'pointer' }}
            >
              再看一份材料
            </button>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
