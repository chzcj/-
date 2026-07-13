import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { HiFiMainShell } from '@/components/hifi/HiFiMainShell'
import { HiFiMascot } from '@/components/hifi/HiFiMascot'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { openPrivacyContract } from '@/lib/wechatPrivacy'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { setPrivacyConsent } from '@/services/privacyConsent'
import { getSessionToken } from '@/services/api'
import { fetchCurrentUser } from '@/services/auth'
import { routeAfterAuth } from '@/utils/navigation'
import './index.scss'

/**
 * 开始页（审核合规）：
 * - 仅「开始」进入体验，不强制微信登录
 * - 隐私协议默认不勾选，用户自主同意
 */
export default function LoginPage() {
  usePublicPageShare({
    title: '育见 - 帮家长看见孩子',
    path: SHARE_PATHS.login,
  })
  const [error, setError] = useState('')
  const [privacyAgreed, setPrivacyAgreed] = useState(false)

  useLoad(() => {
    Taro.setNavigationBarTitle({ title: '育见' })
    void (async () => {
      const token = getSessionToken()
      if (!token) return
      const user = await fetchCurrentUser()
      if (user) routeAfterAuth(user, true)
    })()
  })

  const handleStart = () => {
    if (!privacyAgreed) {
      setError('请先阅读并勾选同意《用户隐私保护指引》')
      return
    }
    setPrivacyConsent(true)
    setError('')
    void Taro.reLaunch({ url: '/packageOnboarding/pages/intro/index' })
  }

  return (
    <HiFiMainShell>
      <View className='hero-card login-hero has-mascot'>
        <Text className='hero-title'>育见</Text>
        <Text className='hero-copy'>帮家长看见孩子，而不是只看见问题</Text>
        <HiFiMascot />
      </View>
      <View className='hifi-card login-card'>
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
          disabled={!privacyAgreed}
          onClick={handleStart}
        >
          开始
        </Button>
      </View>
    </HiFiMainShell>
  )
}
