'use client'
import { useState } from 'react'

/* ================================================================
   专项采集 UI（交付文档 5.3.1 A / 5.3.10）——三个专项功能共用的「建上下文」界面。
   重 UI：标题 + 说明 + 「你可以这样讲」引导卡 + 长文本输入 + 提交并评估。
   只在需要建立新上下文时出现；不展示信息充分度数值（红线 5）。
   ================================================================ */

export interface SpecialCollectionViewProps {
  title: string
  subtitle: string
  /** 「你可以这样讲」——引导家长多讲的方向，非必填表单 */
  inputGuides: string[]
  placeholder: string
  primaryActionText: string
  loadingText?: string
  loading: boolean
  /** 后台返回的额外引导文案（如降级时的 collectionGuide） */
  extraGuide?: string
  onSubmit: (text: string) => void
}

export function SpecialCollectionView({
  title,
  subtitle,
  inputGuides,
  placeholder,
  primaryActionText,
  loadingText,
  loading,
  extraGuide,
  onSubmit
}: SpecialCollectionViewProps) {
  const [text, setText] = useState('')
  const disabled = loading || !text.trim()

  return (
    <div className="special-collection">
      <div style={{ fontSize: 17, fontWeight: 650, color: '#1D1D1F', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#6E6E73', marginBottom: 14, lineHeight: 1.55 }}>{subtitle}</div>

      {extraGuide ? (
        <div style={{ fontSize: 14, lineHeight: 1.6, color: '#1D1D1F', background: 'rgba(110,106,248,0.05)', border: '1px solid rgba(110,106,248,0.10)', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
          {extraGuide}
        </div>
      ) : null}

      {inputGuides.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {inputGuides.map((g) => (
            <div
              key={g}
              style={{ fontSize: 13, color: '#6E6AF8', background: 'rgba(110,106,248,0.05)', border: '1px solid rgba(110,106,248,0.10)', borderRadius: 12, padding: '8px 12px' }}
            >
              {g}
            </div>
          ))}
        </div>
      ) : null}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={loading}
        style={{ width: '100%', minHeight: 150, fontSize: 15, lineHeight: 1.6, padding: 14, borderRadius: 16, border: '1px solid rgba(0,0,0,0.10)', resize: 'vertical', boxSizing: 'border-box' }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => onSubmit(text.trim())}
        style={{ width: '100%', marginTop: 12, padding: '13px 0', fontSize: 15, fontWeight: 600, color: '#fff', background: disabled ? '#B8B6F5' : '#6E6AF8', border: 'none', borderRadius: 14, cursor: disabled ? 'default' : 'pointer' }}
      >
        {loading ? (loadingText || '正在梳理…') : primaryActionText}
      </button>
    </div>
  )
}
