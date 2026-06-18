'use client'

import { Mic, Square } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'

/* ================================================================
   行内语音输入按钮——给任意「自管 state」的输入框零配置接入语音。
   复用项目唯一 ASR 抓手 useTencentAsrInput（腾讯云实时识别），识别完成后把
   整段文本经 onTranscript 回填给调用方（通常追加到其 state）。不改调用方的提交逻辑。

   全局单活麦克风：任一时刻只允许一个语音字段在录，避免多字段页（记录孩子 / 档案卡）
   同时开多路 getUserMedia / WebSocket 冲突。开始新录音前自动停掉其它正在录的字段。
   ================================================================ */

// 模块级集合：保存当前已挂载实例的「中断式停止」函数，实现跨字段的全局单活。
const activeStoppers = new Set<() => void>()

export interface VoiceFieldButtonProps {
  /** 识别完成回填：把这段最终文本交给调用方（默认应追加到其 state，见 appendTranscript） */
  onTranscript: (text: string) => void
  disabled?: boolean
  /** 紧凑模式：一页多字段（记录孩子 / 档案卡）时按钮更小 */
  compact?: boolean
  /** 按钮空闲文案 */
  idleLabel?: string
  className?: string
  style?: CSSProperties
}

export function VoiceFieldButton({
  onTranscript,
  disabled,
  compact = false,
  idleLabel = '语音输入',
  className,
  style,
}: VoiceFieldButtonProps) {
  const voice = useTencentAsrInput()

  // selfStop 始终反映当前 voice 实例的「中断式停止」（停录但不回填，用于被其它字段抢占）。
  const selfStopRef = useRef(() => {})
  selfStopRef.current = () => {
    voice.stopListening()
    voice.reset()
  }
  // stopper 身份稳定，注册进全局集合；内部转调最新的 selfStop。
  const stopperRef = useRef<() => void>()
  if (!stopperRef.current) stopperRef.current = () => selfStopRef.current()

  useEffect(() => {
    const stopper = stopperRef.current as () => void
    return () => {
      activeStoppers.delete(stopper)
    }
  }, [])

  const start = () => {
    if (disabled || voice.isListening) return
    // 全局单活：先停掉其它正在录的字段，再独占。
    activeStoppers.forEach((s) => {
      if (s !== stopperRef.current) s()
    })
    activeStoppers.clear()
    activeStoppers.add(stopperRef.current as () => void)
    voice.reset()
    void voice.startListening()
  }

  const finish = () => {
    const finalText = (voice.stopListening() || voice.liveTranscript).trim()
    activeStoppers.delete(stopperRef.current as () => void)
    if (finalText) onTranscript(finalText)
    voice.reset()
  }

  const iconSize = compact ? 14 : 16

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <button
        type="button"
        onClick={voice.isListening ? finish : start}
        disabled={disabled}
        aria-label={voice.isListening ? '结束录音' : idleLabel}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: compact ? 32 : 36,
          padding: compact ? '0 12px' : '0 14px',
          borderRadius: 999,
          border: '1px solid rgba(110,106,248,0.22)',
          background: voice.isListening ? '#6E6AF8' : 'rgba(110,106,248,0.06)',
          color: voice.isListening ? '#fff' : '#6E6AF8',
          fontSize: compact ? 12 : 13,
          fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'background 150ms ease, color 150ms ease',
        }}
      >
        {voice.isListening ? <Square size={iconSize} /> : <Mic size={iconSize} />}
        {voice.isListening ? '结束录音' : idleLabel}
      </button>

      {/* 录音中实时回显识别文本 */}
      {voice.isListening && voice.liveTranscript ? (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#6E6E73' }}>{voice.liveTranscript}</div>
      ) : null}
      {/* 连不上 ASR / 权限失败时的可见降级提示（绝不静默） */}
      {voice.error ? (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: '#C0392B' }}>{voice.error}</div>
      ) : null}
    </div>
  )
}

/** 把识别出的整段文本追加到已有文本：非空则换行分隔（与 record-child 原有 join('\n') 行为一致）。 */
export function appendTranscript(prev: string, next: string): string {
  const head = (prev || '').replace(/\s+$/, '')
  const tail = (next || '').trim()
  if (!tail) return prev || ''
  if (!head) return tail
  return head + '\n' + tail
}
