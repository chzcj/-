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

/**
 * 登录页（审核合规）：
 * - 不获取手机号 / 头像 / 昵称（仅 wx.login code → 服务端 openid）
 * - 隐私协议默认不勾选，用户自主勾选后方可登录
 * - 页面加载不自动拉起任何授权
 */
export default function LoginPage() {
  usePublicPageShare({
    title: '育见 - 帮家长看见孩子',
    path: SHARE_PATHS.login,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [privacyAgreed, setPrivacyAgreed] = useState(false)

  useLoad(() => {
    Taro.setNavigationBarTitle({ title: '育见' })
  })

  const handleLogin = async () => {
    if (!privacyAgreed) {
      setError('请先阅读并勾选同意《用户隐私保护指引》')
      return
    }
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
        <Text className='login-scope'>
          登录仅使用微信登录凭证识别账号，不获取手机号、头像与昵称。
        </Text>

        <View
          className='login-privacy-row'
          onClick={() => {
            setPrivacyAgreed((v) => !v)
            setError('')
          }}
        >
          <View
            className={`login-privacy-box${privacyAgreed ? ' is-checked' : ''}`}
            aria-role='checkbox'
            aria-checked={privacyAgreed}
          >
            {privacyAgreed ? <Text className='login-privacy-tick'>✓</Text> : null}
          </View>
          <Text className='login-privacy'>
            我已阅读并同意
            <Text
              className='login-privacy__link'
              onClick={(e) => {
                e.stopPropagation?.()
                openPrivacyContract()
              }}
            >
              《用户隐私保护指引》
            </Text>
          </Text>
        </View>

        {error ? <Text className='login-error'>{error}</Text> : null}

        <Button
          className={`btn-primary login-btn${privacyAgreed ? '' : ' is-disabled'}`}
          loading={loading}
          disabled={!privacyAgreed || loading}
          onClick={handleLogin}
        >
          微信登录
        </Button>
      </View>
    </HiFiMainShell>
  )
}
