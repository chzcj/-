import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { useTapFileRecorder } from '@/hooks/useTapFileRecorder'
import { getSessionToken } from '@/services/api'
import { API_BASE_URL } from '@/config/env'
import './index.scss'

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

type Phase = 'idle' | 'recording' | 'uploading' | 'done'

export default function DialogueRecordPage() {
  useSafeShareAppMessage({ title: '育见 · 沟通预演' })
  const recorder = useTapFileRecorder()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')

  useDidShow(() => {
    Taro.hideHomeButton?.()
  })

  const leave = async () => {
    if (recorder.isRecording || phase === 'uploading') {
      const res = await Taro.showModal({
        title: '确定离开？',
        content: phase === 'uploading' ? '正在处理录音，离开后可稍后在预演页查看结果。' : '录音尚未结束。',
        confirmText: '离开',
        cancelText: '继续',
      })
      if (!res.confirm) return
      if (recorder.isRecording) {
        try {
          await recorder.stop()
        } catch {
          /* ignore */
        }
      }
    }
    void Taro.switchTab({ url: '/pages/rehearsal/index' })
  }

  const toggleRecord = async () => {
    setError('')
    if (recorder.isRecording) {
      setPhase('idle')
      const result = await recorder.stop()
      if (result.tooShort || !result.filePath) {
        setError('录音太短，请至少说满两秒。')
        recorder.reset()
        return
      }
      await uploadAndAnalyze(result.filePath)
      return
    }
    const ok = await recorder.start()
    if (ok) setPhase('recording')
  }

  const uploadAndAnalyze = async (filePath: string) => {
    setPhase('uploading')
    setError('')
    try {
      const token = getSessionToken()
      const upload = await Taro.uploadFile({
        url: `${API_BASE_URL}/api/rehearsal/dialogue-transcribe`,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 180000,
      })
      const body = typeof upload.data === 'string' ? JSON.parse(upload.data) : upload.data
      if (!body?.ok) {
        setError(body?.error?.message || '转写或分析失败，请重试。')
        setPhase('idle')
        return
      }
      const analysisId = body.data?.analysisId
      if (body.data?.status === 'skipped') {
        setPhase('idle')
        Taro.showToast({ title: '已跳过分析', icon: 'none' })
        return
      }
      try {
        Taro.setStorageSync('childos_last_dialogue_analysis_id', analysisId)
        if (body.data?.rehearsalSeed) {
          Taro.setStorageSync('childos_rehearsal_dialogue_context', body.data.rehearsalSeed)
        }
      } catch {
        /* ignore */
      }
      setPhase('done')
      void Taro.redirectTo({
        url: `/pages/rehearsal/dialogue-result/index?id=${encodeURIComponent(analysisId)}`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败，请检查网络后重试。')
      setPhase('idle')
    }
  }

  return (
    <View className='dialogue-record-page'>
      <View className='app-safe-top' />
      <DeepPageHeader title='亲子对话录音' showClose onBack={() => void leave()} onClose={() => void leave()} />

      <View className='dialogue-record-body'>
        <Text className='dialogue-record-lead'>录完整段对话后再转文字并分析。录音中不会出现实时字幕。</Text>

        <View className='dialogue-wave-card'>
          {phase === 'recording' || recorder.isRecording ? (
            <>
              <Text className='dialogue-timer'>{formatMs(recorder.elapsedMs)}</Text>
              <View className='dialogue-wave'>
                {Array.from({ length: 7 }).map((_, i) => (
                  <View key={i} className='dialogue-wave-bar' style={{ animationDelay: `${i * 0.08}s` }} />
                ))}
              </View>
              <Text className='dialogue-hint'>录音中 · 最长 10 分钟 · 再点一次结束</Text>
            </>
          ) : phase === 'uploading' ? (
            <>
              <View className='loader' />
              <Text className='dialogue-hint'>正在转写并分析，请稍候…</Text>
            </>
          ) : (
            <>
              <Text className='dialogue-timer idle'>0:00</Text>
              <Text className='dialogue-hint'>点下方按钮开始录音</Text>
            </>
          )}
        </View>

        {(error || recorder.error) && (
          <Text className='dialogue-error'>{error || recorder.error}</Text>
        )}

        <Text
          className={`dialogue-main-btn${phase === 'uploading' ? ' disabled' : ''}${recorder.isRecording ? ' recording' : ''}`}
          onClick={() => {
            if (phase === 'uploading') return
            void toggleRecord()
          }}
        >
          {recorder.isRecording ? '结束录音' : phase === 'uploading' ? '处理中…' : '开始录音'}
        </Text>

        <Text
          className='dialogue-skip'
          onClick={() => {
            if (phase === 'uploading' || recorder.isRecording) return
            void leave()
          }}
        >
          暂不录音，返回预演
        </Text>
      </View>
    </View>
  )
}
