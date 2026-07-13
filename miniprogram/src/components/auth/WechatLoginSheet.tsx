import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { openPrivacyContract } from '@/lib/wechatPrivacy'
import { resolvePostAuthRoute } from '@/lib/postAuthRoute'
import { loginWithWechat } from '@/services/auth'
import './WechatLoginSheet.scss'

type WechatLoginSheetProps = {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export function WechatLoginSheet({ visible, onClose, onSuccess }: WechatLoginSheetProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setError('')
      setLoading(false)
    }
  }, [visible])

  if (!visible) return null

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const res = await loginWithWechat()
    if (!res.ok) {
      setLoading(false)
      setError(res.message)
      return
    }
    try {
      await resolvePostAuthRoute({ mergeLocal: true, navigate: false })
      setLoading(false)
      onSuccess()
    } catch {
      setLoading(false)
      setError('登录成功，但数据准备失败，请重试')
    }
  }

  return (
    <View className='login-sheet-root' catchMove>
      <View className='login-sheet-mask' onClick={onClose} />
      <View className='login-sheet-panel'>
        <View className='login-sheet-handle' />
        <Text className='login-sheet-title'>登录后继续</Text>
        <Text className='login-sheet-copy'>
          登录后可保存你的记录，并在不同设备找回。开始页已同意
          <Text className='login-sheet-link' onClick={() => openPrivacyContract()}>
            《用户隐私保护指引》
          </Text>
        </Text>
        {error ? <Text className='login-sheet-error'>{error}</Text> : null}
        <View className='login-sheet-actions'>
          <View
            className={`login-sheet-btn login-sheet-btn--primary${loading ? ' is-loading' : ''}`}
            onClick={() => {
              if (!loading) void handleLogin()
            }}
          >
            <Text>{loading ? '登录中…' : '微信登录'}</Text>
          </View>
          <View className='login-sheet-btn login-sheet-btn--quiet' onClick={onClose}>
            <Text>暂不登录</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
