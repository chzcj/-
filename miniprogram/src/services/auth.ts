import Taro from '@tarojs/taro'
import type { AuthUser, WechatLoginResponse } from '@yujian/contracts'
import { apiRequest, clearSessionToken, setSessionToken } from '@/services/api'

/**
 * 静默微信登录：仅 wx.login 拿到 code，服务端换 openid/session。
 * 禁止 getPhoneNumber / getUserProfile / chooseAvatar——不收集手机号、头像、昵称。
 */
export async function loginWithWechat(): Promise<{ ok: true; user: AuthUser; isNewUser: boolean } | { ok: false; message: string }> {
  try {
    const loginRes = await Taro.login()
    if (!loginRes.code) {
      return { ok: false, message: '微信登录失败，请重试' }
    }
    const res = await apiRequest<WechatLoginResponse>('/api/auth/wechat', {
      method: 'POST',
      data: { code: loginRes.code },
      auth: false,
    })
    if (!res.ok) {
      return { ok: false, message: res.error.message || '登录失败' }
    }
    setSessionToken(res.data.sessionToken)
    return { ok: true, user: res.data.user, isNewUser: res.data.isNewUser }
  } catch {
    return { ok: false, message: '微信登录异常' }
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await apiRequest<{ user: AuthUser | null }>('/api/auth/me', { method: 'GET' })
  if (!res.ok || !res.data.user) return null
  return res.data.user
}

export async function logout(): Promise<void> {
  const { forceAccountSyncToServer } = await import('@/services/accountSync')
  const { clearAllChildOSData } = await import('@/services/localStorageService')
  await forceAccountSyncToServer()
  await apiRequest('/api/auth/logout', { method: 'POST' })
  clearSessionToken()
  clearAllChildOSData()
}
