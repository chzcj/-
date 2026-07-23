import Taro from '@tarojs/taro'
import { View, Text, Textarea } from '@tarojs/components'
import { useRef, useEffect, useState } from 'react'
import { useTencentAsrInput } from '@/hooks/useTencentAsrInput'
import { ensureRecordPermission, getRecordAuthStatus } from '@/lib/asrPermission'
import { getEntryCaptureCharHint } from '@/lib/entryCharHint'

const MAX_LENGTH = 4000

type BuildRecordBoxProps = {
  label: string
  status: string
  value: string
  placeholder: string
  disabled?: boolean
  metaLeft?: string
  showCharHint?: boolean
  /** 用于字数提示的字数（追问页传「本模块已累计+本轮草稿」） */
  charHintCount?: number
  showMeta?: boolean
  onChange: (value: string) => void
  onVoiceText?: (text: string) => void
}

export function BuildRecordBox({
  label,
  status,
  value,
  placeholder,
  disabled,
  metaLeft = '说清楚就行，后面会帮你整理。',
  showCharHint = true,
  charHintCount,
  showMeta = true,
  onChange,
  onVoiceText,
}: BuildRecordBoxProps) {
  const voice = useTencentAsrInput()
  const charCount = value.trim().length
  const hintCount = charHintCount ?? charCount
  const charHint = getEntryCaptureCharHint(hintCount)
  const valueRef = useRef(value)
  const cursorRef = useRef(value.length)
  const touchStartAtRef = useRef(0)
  const holdingRef = useRef(false)
  const finishingRef = useRef(false)
  const [fingerDown, setFingerDown] = useState(false)
  const [permHint, setPermHint] = useState('')
  const [restoreCursor, setRestoreCursor] = useState<number | undefined>()

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const finishVoice = () => {
    setFingerDown(false)
    const wasHolding = holdingRef.current
    holdingRef.current = false
    if (!wasHolding || finishingRef.current) return
    if (Date.now() - touchStartAtRef.current < voice.minHoldMs) {
      void voice.stopListening({ fast: true })
      voice.reset()
      return
    }
    finishingRef.current = true
    void voice
      .stopListening({ fast: true })
      .then((finalText) => {
        finishingRef.current = false
        voice.reset()
        if (finalText) {
          const current = valueRef.current
          const cursor = Math.max(0, Math.min(cursorRef.current, current.length))
          const next = `${current.slice(0, cursor)}${finalText}${current.slice(cursor)}`
          const nextCursor = cursor + finalText.length
          cursorRef.current = nextCursor
          setRestoreCursor(nextCursor)
          onChange(next)
          onVoiceText?.(finalText)
        }
      })
      .catch(() => {
        finishingRef.current = false
      })
  }

  useEffect(() => {
    if (!voice.error) return
    holdingRef.current = false
    finishingRef.current = false
    setFingerDown(false)
  }, [voice.error])

  const handleTouchStart = () => {
    if (disabled || voice.asrUnavailable || holdingRef.current) return
    setFingerDown(true)
    holdingRef.current = true
    touchStartAtRef.current = Date.now()
    finishingRef.current = false
    voice.clearError()
    setPermHint('')

    void (async () => {
      // 权限申请不依赖按住态：松手后也要走完（否则快速点按会静默吞掉授权弹窗）
      const status = await getRecordAuthStatus()

      if (status !== 'granted') {
        setFingerDown(false)
        holdingRef.current = false
        const perm = await ensureRecordPermission({ interactive: true })
        if (!perm.ok) {
          setPermHint(perm.message)
          return
        }
        setPermHint('麦克风已开启，请再次按住说话')
        return
      }

      if (!holdingRef.current) return
      void voice.startListening()
    })()
  }

  const holdActive = fingerDown || voice.isListening
  const holdLabel = voice.asrUnavailable
    ? '请直接输入'
    : holdActive
      ? '松手结束'
      : '按住说话'

  return (
    <View className='record-box'>
      <View className='record-head'>
        <Text className='record-head-title'>{label}</Text>
        <View className='record-status'>
          <Text className='record-status-text'>{status}</Text>
        </View>
      </View>
      {voice.simulatorUnsupported ? (
        <Text className='hint-text'>模拟器不支持语音，请用真机预览或直接在上方输入</Text>
      ) : null}
      <Textarea
        className='record-area'
        value={value}
        cursor={restoreCursor}
        disabled={disabled}
        placeholder={placeholder}
        maxlength={MAX_LENGTH}
        adjustPosition={false}
        holdKeyboard
        showConfirmBar={false}
        disableDefaultPadding
        cursorSpacing={120}
        onFocus={() => {
          // 鸿蒙/Android：禁用原生顶页后，轻推滚动区，避免输入框落在键盘下（.page 内滚动）
          requestAnimationFrame(() => {
            Taro.createSelectorQuery()
              .select('.hifi-build-root .record-box')
              .boundingClientRect((rect) => {
                const box = Array.isArray(rect) ? rect[0] : rect
                if (!box || typeof box.top !== 'number') return
                const windowHeight = Taro.getSystemInfoSync().windowHeight
                if (box.top < windowHeight * 0.55) return
                void Taro.pageScrollTo({
                  scrollTop: Math.max(0, box.top - 96),
                  duration: 200,
                }).catch(() => undefined)
              })
              .exec()
          })
        }}
        onInput={(e) => {
          cursorRef.current = typeof e.detail.cursor === 'number' ? e.detail.cursor : e.detail.value.length
          setRestoreCursor(undefined)
          onChange(e.detail.value)
        }}
      />
      {showMeta ? (
        <View className='record-meta'>
          <Text className='record-meta-left'>{metaLeft}</Text>
          <Text className='record-meta-count'>
            {value.length}/{MAX_LENGTH}
          </Text>
        </View>
      ) : null}
      {showCharHint && charHint ? (
        <Text className='hint-text'>{charHint}</Text>
      ) : null}

      <View className={`recording-strip${holdActive ? ' active' : ''}`}>
        <View className='recording-card'>
          <View className='wave'>
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={i} className='wave-bar' />
            ))}
          </View>
          <Text className='recording-text'>{holdActive ? '正在记录' : '准备记录'}</Text>
          <Text className='cancel-hint'>{voice.liveTranscript || '按住约 1 分钟；原话、时间点都可以讲'}</Text>
        </View>
      </View>

      <View className='record-voice-row'>
        <View
          className={`build-hold-button${holdActive ? ' active' : ''}${voice.asrUnavailable ? ' disabled' : ''}`}
          hoverClass='none'
          onTouchStart={handleTouchStart}
          onTouchEnd={finishVoice}
          onTouchCancel={finishVoice}
        >
          <Text className='build-hold-button-text'>{holdLabel}</Text>
        </View>
      </View>

      {permHint ? <Text className='hifi-voice-error'>{permHint}</Text> : null}
      {voice.error ? <Text className='hifi-voice-error'>{voice.error}</Text> : null}
    </View>
  )
}

export { MAX_LENGTH as BUILD_RECORD_MAX_LENGTH }
