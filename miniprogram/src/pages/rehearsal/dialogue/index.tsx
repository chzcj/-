import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { DeepPageHeader } from '@/components/nav/DeepPageHeader'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { useTapFileRecorder } from '@/hooks/useTapFileRecorder'
import { getSessionToken } from '@/services/api'
import { API_BASE_URL } from '@/config/env'
import { writeLastDialogueAnalysisId } from '@/lib/rehearsalScenesCache'
import './index.scss'

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

type Phase = 'idle' | 'recording' | 'uploading' | 'done'

function uploadFailureMessage(error: unknown): string {
  const errMsg =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'errMsg' in error &&
          typeof (error as { errMsg?: unknown }).errMsg === 'string'
        ? (error as { errMsg: string }).errMsg
        : ''
  return errMsg ? `上传失败：${errMsg}` : '上传失败，请检查网络后重试。'
}

/** 上传前确认临时录音文件仍存在（区分录音层 vs uploadFile 层失败） */
function verifyRecordingFile(filePath: string): Promise<{ ok: true; size: number } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    try {
      const fsm = Taro.getFileSystemManager()
      fsm.getFileInfo({
        filePath,
        success: (res) => {
          const size = typeof res.size === 'number' ? res.size : 0
          if (size < 1) {
            console.warn('[dialogue-upload] temp file empty', { filePath, size })
            resolve({ ok: false, message: '录音文件无效，请重新录制。' })
            return
          }
          console.info('[dialogue-upload] temp file ok', { filePath, size })
          resolve({ ok: true, size })
        },
        fail: (err) => {
          console.error('[dialogue-upload] getFileInfo failed', { filePath, err })
          const errMsg = typeof err?.errMsg === 'string' ? err.errMsg : ''
          resolve({
            ok: false,
            message: errMsg
              ? `录音文件已失效（${errMsg}），请重新录制。`
              : '录音文件已失效，请重新录制。',
          })
        },
      })
    } catch (e) {
      console.error('[dialogue-upload] getFileInfo threw', e)
      resolve({ ok: false, message: '录音文件校验失败，请重新录制。' })
    }
  })
}

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
      const fileCheck = await verifyRecordingFile(filePath)
      if (!fileCheck.ok) {
        setError(fileCheck.message)
        setPhase('idle')
        recorder.reset()
        return
      }

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
      if (!analysisId?.startsWith('da_')) {
        setError('分析结果无效，请重试。')
        setPhase('idle')
        return
      }
      if (body.data?.status === 'skipped') {
        setPhase('idle')
        Taro.showToast({ title: '已跳过分析', icon: 'none' })
        return
      }
      if (body.data?.status === 'insufficient') {
        // 录音里没有有效亲子对话：温和提示重录，不进入分析结果页
        setPhase('idle')
        setError(body.data?.message || '这段录音里没有听到有效的亲子对话，可以再录一段。')
        recorder.reset()
        return
      }
      try {
        writeLastDialogueAnalysisId(analysisId)
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
      // 微信上 uploadFile 的失败值通常是普通对象 { errMsg }，不是 Error；
      // 保留原始失败原因，才能区分本地文件、域名校验和服务端响应问题。
      console.error('[dialogue-upload] uploadFile failed', e)
      setError(uploadFailureMessage(e))
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

        <View
          className={`dialogue-main-btn${phase === 'uploading' ? ' disabled' : ''}${recorder.isRecording ? ' recording' : ''}`}
          hoverClass='none'
          onClick={() => {
            if (phase === 'uploading') return
            void toggleRecord()
          }}
        >
          <Text className='dialogue-main-btn-text'>
            {recorder.isRecording ? '结束录音' : phase === 'uploading' ? '处理中…' : '开始录音'}
          </Text>
        </View>

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
