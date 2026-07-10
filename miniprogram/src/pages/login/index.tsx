import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { HiFiMascot } from '@/components/hifi/HiFiMascot'
import { resolvePostAuthRoute } from '@/lib/postAuthRoute'
import { loginWithWechat } from '@/services/auth'
import './index.scss'

export default function LoginPage() {
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
      <View className='hero-card login-hero'>
        <Text className='hero-title'>育见</Text>
        <Text className='hero-copy'>帮家长看见孩子，而不是只看见问题</Text>
        <HiFiMascot />
      </View>
      <View className='hifi-card login-card'>
        <Text className='muted'>使用微信一键登录，与网页版数据互通（同一后端）</Text>
        {error ? <Text className='login-error'>{error}</Text> : null}
        <Button className='btn-primary login-btn' loading={loading} onClick={handleLogin}>
          微信一键登录
        </Button>
      </View>
    </HiFiMainShell>
  )
}
