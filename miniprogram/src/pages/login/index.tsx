import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { HiFiMascot } from '@/components/hifi/HiFiMascot'
import { resolvePostAuthRoute } from '@/lib/postAuthRoute'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { openPrivacyContract } from '@/lib/wechatPrivacy'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { loginWithWechat } from '@/services/auth'
import './index.scss'

export default function LoginPage() {
  usePublicPageShare({
    title: '育见 - 帮家长看见孩子',
    path: SHARE_PATHS.login,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useLoad(() => {
    Taro.setNavigationBarTitle({ title: '育见' })
  })

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
      await resolvePostAuthRoute(true)
    } catch {
      setError('登录成功，但同步数据失败，请重试')
    }
    setLoading(false)
  }

  return (
    <HiFiMainShell>
      <View className='hero-card login-hero has-mascot'>
        <Text className='hero-title'>育见</Text>
        <Text className='hero-copy'>帮家长看见孩子，而不是只看见问题</Text>
        <HiFiMascot />
      </View>
      <View className='hifi-card login-card'>
        {error ? <Text className='login-error'>{error}</Text> : null}
        <Button className='btn-primary login-btn' loading={loading} onClick={handleLogin}>
          微信一键登录
        </Button>
        <Text className='login-privacy'>
          登录即表示你已阅读并同意
          <Text className='login-privacy__link' onClick={openPrivacyContract}>
            《用户隐私保护指引》
          </Text>
        </Text>
      </View>
    </HiFiMainShell>
  )
}
