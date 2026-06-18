'use client'
import { useState } from 'react'
import { VoiceFieldButton, appendTranscript } from '@/components/voice/VoiceFieldButton'

/* ================================================================
   轻追问 UI（交付文档 5.3.1 B / 5.3.11）——在已有上下文上「推判断」。
   轻 UI：先承接 → 一个主问题 → 短回复输入。
   不展示进度条 / 信息充分度，不做成问卷（红线 2）。
   ================================================================ */

export interface LightFollowupViewProps {
  /** 先承接上一轮 */
  acknowledgement: string
  /** 只问一个最关键的点 */
  question: string
  /** 可选：还想了解的方面（自然语言 chip，非数值） */
  missingInfo?: string[]
  loading: boolean
  onSubmit: (text: string) => void
}

export function LightFollowupView({ acknowledgement, question, missingInfo = [], loading, onSubmit }: LightFollowupViewProps) {
  const [text, setText] = useState('')
  const disabled = loading || !text.trim()

  return (
    <div className="light-followup">
      {acknowledgement ? (
        <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', marginBottom: 12 }}>{acknowledgement}</div>
      ) : null}

      {/* 一个主问题，对话气泡感 */}
      <div style={{ fontSize: 15, lineHeight: 1.6, color: '#1D1D1F', background: 'rgba(110,106,248,0.06)', borderRadius: 16, borderTopLeftRadius: 4, padding: '12px 14px', marginBottom: missingInfo.length ? 10 : 14 }}>
        {question}
      </div>

      {missingInfo.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {missingInfo.slice(0, 4).map((m) => (
            <span key={m} style={{ fontSize: 12, color: '#6E6AF8', background: 'rgba(110,106,248,0.08)', borderRadius: 999, padding: '4px 10px' }}>
              {m}
            </span>
          ))}
        </div>
      ) : null}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="不用说得很完整，凭最近几次印象说就行"
        disabled={loading}
        style={{ width: '100%', minHeight: 88, fontSize: 15, lineHeight: 1.6, padding: 14, borderRadius: 16, border: '1px solid rgba(0,0,0,0.10)', resize: 'vertical', boxSizing: 'border-box' }}
      />

      {/* 语音输入：说一说自动转文字 */}
      <VoiceFieldButton
        disabled={loading}
        idleLabel="说一说，自动转文字"
        onTranscript={(t) => setText((prev) => appendTranscript(prev, t))}
        style={{ marginTop: 10 }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => onSubmit(text.trim())}
        style={{ width: '100%', marginTop: 12, padding: '13px 0', fontSize: 15, fontWeight: 600, color: '#fff', background: disabled ? '#B8B6F5' : '#6E6AF8', border: 'none', borderRadius: 14, cursor: disabled ? 'default' : 'pointer' }}
      >
        {loading ? '正在结合你说的看…' : '说说看'}
      </button>
    </div>
  )
}
