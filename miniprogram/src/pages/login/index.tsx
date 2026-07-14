import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { SHARE_PATHS } from '@/lib/shareMessages'
import { openPrivacyContract } from '@/lib/wechatPrivacy'
import { usePublicPageShare } from '@/hooks/useSharePage'
import { setPrivacyConsent } from '@/services/privacyConsent'
import { getSessionToken } from '@/services/api'
import { fetchCurrentUser } from '@/services/auth'
import { routeAfterAuth } from '@/utils/navigation'
import './index.scss'

/**
 * 开始页：对齐 design-reference/pages startup-gate 封面
 * 静止开屏 · 底部隐私勾选 ·「开始」进入 onboarding
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
    <View className='login-splash-root'>
      <View className='login-splash-bg' aria-hidden>
        <View className='login-splash-ring login-splash-ring--large' />
        <View className='login-splash-ring login-splash-ring--small' />
      </View>

      <View className='app-safe-top' />
      <View className='login-splash-body'>
        <View className='login-splash-center'>
          <Text className='login-splash-title'>你好！</Text>
          <Text className='login-splash-subtitle'>欢迎来到育见</Text>
        </View>

        <View className='login-splash-footer'>
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
            className={`login-splash-btn${privacyAgreed ? '' : ' is-disabled'}`}
            disabled={!privacyAgreed}
            onClick={handleStart}
          >
            开始
          </Button>
        </View>
      </View>
    </View>
  )
}
